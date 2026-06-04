-- 088_venue_referral_config.sql
-- Refinements to the venue referral system before staging.
--
-- 1. offer_venue_referral_config
--    Per-offer configuration: referrer reward, optional friend reward, per-member
--    reward limit. Same pattern as offer_loyalty_config.
--
-- 2. venue_referral_invitations.was_existing_member
--    Set at attribution time. Used for analytics: separate "new BOL members
--    generated" from "existing BOL members referred".
--    NULL for rows created before this migration.
--
-- 3. Updated attribute_venue_referral
--    Populates was_existing_member when writing the invitation row.
--
-- 4. Updated try_unlock_venue_referral_rewards
--    a. Enforces max_rewards_per_referrer if set on the offer config.
--    b. Inserts an in-app notification to the referrer after unlocking.
--
-- 5. Updated get_venue_referral_status
--    Returns two new columns: reward_title (from config), platform_referral_code
--    (from referral_codes for this profile). The share URL on mobile embeds
--    the platform code (?t=TOKEN&ref=CODE) so Scenario A platform referrals
--    still flow through the existing apply_referral_code + 30-day eligibility
--    path. No bypass of platform anti-abuse rules.
--
-- 6. New upsert_venue_referral_config
--    Called by the retailer portal server action when saving a venue_referral offer.

-- ── 1. offer_venue_referral_config ───────────────────────────────────────────

create table offer_venue_referral_config (
  offer_id                  uuid        primary key
                              references offers(id) on delete cascade,
  reward_title              text        not null,
  reward_description        text,
  friend_reward_enabled     boolean     not null default false,
  friend_reward_title       text,
  friend_reward_description text,
  max_rewards_per_referrer  integer,    -- null = unlimited
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);

create trigger offer_venue_referral_config_updated_at
  before update on offer_venue_referral_config
  for each row execute function set_updated_at();

-- Service role owns writes; authenticated can read their retailer's own config
-- via the existing offer RLS. Direct select is handled by the RPC which is
-- security definer — no RLS needed on this table for consumers.
grant select on offer_venue_referral_config to authenticated;
grant all    on offer_venue_referral_config to service_role;

comment on table offer_venue_referral_config is
  'Per-offer configuration for venue_referral offers. Mirrors offer_loyalty_config.
   reward_title: what the referrer receives (e.g. "Free haircut").
   friend_reward_*: optional reward shown to the invited friend on the share link.
   max_rewards_per_referrer: per-member cap (null = unlimited).';

-- ── 2. was_existing_member column ────────────────────────────────────────────

alter table venue_referral_invitations
  add column if not exists was_existing_member boolean;

comment on column venue_referral_invitations.was_existing_member is
  'True if invitee already had a consumer_memberships row at attribution time.
   False = brand-new BOL member attracted via this referral.
   NULL for rows created before migration 088.
   Used for analytics only — does not gate reward attribution.';

-- ── 3. Updated attribute_venue_referral ──────────────────────────────────────

create or replace function attribute_venue_referral(
  p_token              text,
  p_invitee_profile_id uuid
)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_share_token       venue_referral_share_tokens%rowtype;
  v_existing_member   boolean;
begin
  -- Resolve the token.
  select * into v_share_token
    from venue_referral_share_tokens
   where token = upper(p_token);

  if not found then
    return 'not_found';
  end if;

  -- Self-referral guard.
  if v_share_token.referrer_profile_id = p_invitee_profile_id then
    return 'self_referral';
  end if;

  -- Already attributed for this offer.
  if exists(
    select 1 from venue_referral_invitations
     where offer_id            = v_share_token.offer_id
       and invitee_profile_id  = p_invitee_profile_id
  ) then
    return 'already_attributed';
  end if;

  -- Determine whether the invitee is an existing BOL member.
  -- True if they have ANY consumer_memberships row (past or present).
  v_existing_member := exists(
    select 1 from consumer_memberships
     where profile_id = p_invitee_profile_id
  );

  -- Write attribution.
  insert into venue_referral_invitations(
    offer_id, referrer_profile_id, invitee_profile_id, share_token, was_existing_member
  )
  values (
    v_share_token.offer_id, v_share_token.referrer_profile_id,
    p_invitee_profile_id, p_token, v_existing_member
  )
  on conflict (offer_id, invitee_profile_id) do nothing;

  return 'ok';
end;
$$;

grant execute on function attribute_venue_referral(text, uuid) to authenticated;

-- ── 4. Updated try_unlock_venue_referral_rewards ──────────────────────────────

create or replace function try_unlock_venue_referral_rewards(
  p_redemption_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_rd                redemptions%rowtype;
  v_inv               venue_referral_invitations%rowtype;
  v_prior_count       bigint;
  v_max_rewards       integer;
  v_earned_count      bigint;
  v_retailer_name     text;
  v_new_reward_id     uuid;
begin
  -- Load the redemption row.
  select * into v_rd from redemptions where id = p_redemption_id;
  if not found then return; end if;
  if v_rd.status <> 'success' then return; end if;

  -- Retailer name for notification body.
  select name into v_retailer_name from retailers where id = v_rd.retailer_id;

  -- Find pending invitations for this invitee at this retailer.
  for v_inv in
    select vri.*
      from venue_referral_invitations vri
      join offers o on o.id = vri.offer_id
     where vri.invitee_profile_id = v_rd.profile_id
       and o.retailer_id          = v_rd.retailer_id
       and not exists(
         select 1 from venue_referral_rewards vrr
          where vrr.invitation_id = vri.id
       )
  loop
    -- New-customer check: zero successful redemptions at this retailer
    -- before the attribution timestamp.
    select count(*) into v_prior_count
      from redemptions r
     where r.profile_id   = v_inv.invitee_profile_id
       and r.retailer_id  = v_rd.retailer_id
       and r.status       = 'success'
       and r.created_at   < v_inv.attributed_at;

    if v_prior_count > 0 then
      continue;
    end if;

    -- Per-member reward cap check (from offer config, if set).
    select max_rewards_per_referrer into v_max_rewards
      from offer_venue_referral_config
     where offer_id = v_inv.offer_id;

    if v_max_rewards is not null then
      select count(*) into v_earned_count
        from venue_referral_rewards
       where referrer_profile_id = v_inv.referrer_profile_id
         and offer_id             = v_inv.offer_id
         and status               in ('unlocked', 'redeemed');

      if v_earned_count >= v_max_rewards then
        continue;
      end if;
    end if;

    -- Insert reward.
    insert into venue_referral_rewards(
      invitation_id, offer_id, referrer_profile_id, status
    )
    values (
      v_inv.id, v_inv.offer_id, v_inv.referrer_profile_id, 'unlocked'
    )
    on conflict (invitation_id) do nothing
    returning id into v_new_reward_id;

    -- Notify referrer only when a new reward row was actually inserted.
    if v_new_reward_id is not null then
      perform insert_notification(
        v_inv.referrer_profile_id,
        'venue_referral_converted',
        '🎉 Your referral reward is ready',
        'Someone you referred became a customer at ' ||
          coalesce(v_retailer_name, 'a venue you shared') ||
          '. Claim your reward.',
        jsonb_build_object(
          'reward_id', v_new_reward_id,
          'offer_id',  v_inv.offer_id
        )
      );
    end if;

  end loop;
end;
$$;

revoke execute on function try_unlock_venue_referral_rewards(uuid) from public;
revoke execute on function try_unlock_venue_referral_rewards(uuid) from anon;
revoke execute on function try_unlock_venue_referral_rewards(uuid) from authenticated;
grant  execute on function try_unlock_venue_referral_rewards(uuid) to service_role;

-- ── 5. Updated get_venue_referral_status ─────────────────────────────────────

-- DROP required: RETURNS TABLE grew from 4 to 6 columns (added reward_title,
-- platform_referral_code). PostgreSQL does not allow CREATE OR REPLACE to
-- change OUT parameter types or count — a DROP + CREATE is the only option.
drop function if exists get_venue_referral_status(uuid, uuid);

create or replace function get_venue_referral_status(
  p_offer_id   uuid,
  p_profile_id uuid
)
returns table(
  share_token            text,
  invited_count          bigint,
  unlocked_count         bigint,
  redeemed_count         bigint,
  reward_title           text,
  platform_referral_code text
)
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select
    (select token from venue_referral_share_tokens
      where offer_id = p_offer_id and referrer_profile_id = p_profile_id)
      as share_token,
    (select count(*) from venue_referral_invitations
      where offer_id = p_offer_id and referrer_profile_id = p_profile_id)
      as invited_count,
    (select count(*) from venue_referral_rewards
      where offer_id = p_offer_id and referrer_profile_id = p_profile_id
        and status = 'unlocked')
      as unlocked_count,
    (select count(*) from venue_referral_rewards
      where offer_id = p_offer_id and referrer_profile_id = p_profile_id
        and status = 'redeemed')
      as redeemed_count,
    (select reward_title from offer_venue_referral_config
      where offer_id = p_offer_id)
      as reward_title,
    (select code from referral_codes
      where profile_id = p_profile_id and is_active = true
      limit 1)
      as platform_referral_code;
$$;

grant execute on function get_venue_referral_status(uuid, uuid) to authenticated;

-- ── 6. upsert_venue_referral_config ──────────────────────────────────────────

create or replace function upsert_venue_referral_config(
  p_offer_id                  uuid,
  p_reward_title              text,
  p_reward_description        text        default null,
  p_friend_reward_enabled     boolean     default false,
  p_friend_reward_title       text        default null,
  p_friend_reward_description text        default null,
  p_max_rewards_per_referrer  integer     default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into offer_venue_referral_config(
    offer_id, reward_title, reward_description,
    friend_reward_enabled, friend_reward_title, friend_reward_description,
    max_rewards_per_referrer
  )
  values (
    p_offer_id, p_reward_title, p_reward_description,
    p_friend_reward_enabled, p_friend_reward_title, p_friend_reward_description,
    p_max_rewards_per_referrer
  )
  on conflict (offer_id) do update
    set reward_title              = excluded.reward_title,
        reward_description        = excluded.reward_description,
        friend_reward_enabled     = excluded.friend_reward_enabled,
        friend_reward_title       = excluded.friend_reward_title,
        friend_reward_description = excluded.friend_reward_description,
        max_rewards_per_referrer  = excluded.max_rewards_per_referrer,
        updated_at                = now();
end;
$$;

revoke execute on function upsert_venue_referral_config(uuid, text, text, boolean, text, text, integer) from public;
revoke execute on function upsert_venue_referral_config(uuid, text, text, boolean, text, text, integer) from anon;
revoke execute on function upsert_venue_referral_config(uuid, text, text, boolean, text, text, integer) from authenticated;
grant  execute on function upsert_venue_referral_config(uuid, text, text, boolean, text, text, integer) to service_role;
