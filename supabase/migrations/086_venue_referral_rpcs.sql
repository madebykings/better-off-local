-- 086_venue_referral_rpcs.sql
-- RPCs for the venue referral rewards system.
--
-- get_or_create_venue_referral_token
--   Lazily generates a unique share token for a (referrer, offer) pair.
--   Idempotent — returns the same token on repeated calls.
--   Callable by authenticated users.
--
-- attribute_venue_referral
--   Records an invitation when an invitee is identified after clicking a share link.
--   Returns 'ok' | 'not_found' | 'self_referral' | 'already_attributed'.
--   Callable by authenticated users.
--
-- try_unlock_venue_referral_rewards
--   Called by the AFTER INSERT trigger on redemptions.
--   For each pending invitation linked to the redemption's retailer:
--     • checks the invitee had zero prior successful redemptions at that
--       retailer before their attributed_at timestamp (new-customer rule)
--     • inserts a venue_referral_rewards row (unlocked) if the check passes
--   ON CONFLICT DO NOTHING prevents double rewards in concurrent scenarios.
--   Service_role only.
--
-- redeem_venue_referral_reward
--   Called by validate-qr-token edge function when offer_type = 'venue_referral'.
--   Mirrors the process_loyalty_stamp pattern:
--     0.  Idempotency check
--     1.  Resolve caller's retailer
--     2.  SELECT … FOR UPDATE on token
--     3.  Correct retailer
--     4.  Token not expired
--     5.  Token not consumed
--     6.  Consumer membership active
--     7.  Offer live, correct type, in date window
--     8.  Referrer has an unlocked reward for this offer
--     9.  Lock the reward row
--    10.  Consume token, insert redemption, mark reward redeemed, record attempt
--    11.  Return result
--   Service_role only.
--
-- get_venue_referral_status
--   Lightweight read RPC for the mobile offer detail screen.
--   Returns share_token, invited_count, unlocked_count, redeemed_count.
--   Callable by authenticated users.

-- ── get_or_create_venue_referral_token ────────────────────────────────────────

create or replace function get_or_create_venue_referral_token(
  p_offer_id   uuid,
  p_profile_id uuid
)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_token     text;
  v_attempt   integer := 0;
  v_chars     text    := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_len       integer := 8;
begin
  -- Return existing token if present (idempotent).
  select token into v_token
    from venue_referral_share_tokens
   where offer_id = p_offer_id
     and referrer_profile_id = p_profile_id;
  if found then
    return v_token;
  end if;

  -- Verify the offer exists and is a venue_referral type.
  if not exists(
    select 1 from offers
     where id = p_offer_id
       and offer_type = 'venue_referral'
  ) then
    raise exception 'offer_not_found';
  end if;

  -- Generate a unique token.
  loop
    v_attempt := v_attempt + 1;
    if v_attempt > 50 then
      raise exception 'Could not generate unique venue referral token after 50 attempts';
    end if;

    v_token := '';
    for i in 1..v_len loop
      v_token := v_token || substr(v_chars, floor(random() * length(v_chars) + 1)::int, 1);
    end loop;

    begin
      insert into venue_referral_share_tokens(offer_id, referrer_profile_id, token)
      values (p_offer_id, p_profile_id, v_token);
      return v_token;
    exception when unique_violation then
      continue;
    end;
  end loop;
end;
$$;

-- Callable by authenticated users (members generate their own token)
grant execute on function get_or_create_venue_referral_token(uuid, uuid) to authenticated;

-- ── attribute_venue_referral ──────────────────────────────────────────────────

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
  v_share_token venue_referral_share_tokens%rowtype;
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

  -- Write attribution.
  insert into venue_referral_invitations(
    offer_id, referrer_profile_id, invitee_profile_id, share_token
  )
  values (
    v_share_token.offer_id, v_share_token.referrer_profile_id,
    p_invitee_profile_id, p_token
  )
  on conflict (offer_id, invitee_profile_id) do nothing;

  return 'ok';
end;
$$;

-- Callable by authenticated users (invitee attributes after landing on share link)
grant execute on function attribute_venue_referral(text, uuid) to authenticated;

-- ── try_unlock_venue_referral_rewards ─────────────────────────────────────────
-- Called by an AFTER INSERT trigger on redemptions whenever status = 'success'.
-- Checks whether any pending venue_referral_invitations for this
-- (invitee, retailer) qualify for reward unlock:
--   • The invitee must have had zero prior successful redemptions at the
--     retailer BEFORE their attributed_at timestamp.
-- Inserts one venue_referral_rewards row per qualifying invitation.
-- ON CONFLICT DO NOTHING is safe because invitation_id is unique on that table.

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
begin
  -- Load the redemption row.
  select * into v_rd from redemptions where id = p_redemption_id;
  if not found then return; end if;
  if v_rd.status <> 'success' then return; end if;

  -- Find pending invitations for this invitee at this retailer.
  -- An invitation is pending if no reward exists yet.
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

    if v_prior_count = 0 then
      insert into venue_referral_rewards(
        invitation_id, offer_id, referrer_profile_id, status
      )
      values (
        v_inv.id, v_inv.offer_id, v_inv.referrer_profile_id, 'unlocked'
      )
      on conflict (invitation_id) do nothing;
    end if;
  end loop;
end;
$$;

revoke execute on function try_unlock_venue_referral_rewards(uuid) from public;
revoke execute on function try_unlock_venue_referral_rewards(uuid) from anon;
revoke execute on function try_unlock_venue_referral_rewards(uuid) from authenticated;
grant  execute on function try_unlock_venue_referral_rewards(uuid) to service_role;

-- ── AFTER INSERT trigger on redemptions ───────────────────────────────────────
-- Calls try_unlock_venue_referral_rewards after every successful redemption.
-- Errors are swallowed so a bug in the referral logic can never block a redemption.

create or replace function _trigger_venue_referral_on_redemption()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.status = 'success' then
    begin
      perform try_unlock_venue_referral_rewards(new.id);
    exception when others then
      null; -- referral logic must never block redemptions
    end;
  end if;
  return null;
end;
$$;

create trigger trigger_venue_referral_on_redemption
  after insert on redemptions
  for each row
  execute function _trigger_venue_referral_on_redemption();

-- ── redeem_venue_referral_reward ──────────────────────────────────────────────

create or replace function redeem_venue_referral_reward(
  p_token_hash              text,
  p_retailer_profile_id     uuid,
  p_redemption_attempt_id   uuid
)
returns table(
  valid             boolean,
  status            text,
  rejection_reason  text,
  offer_title       text,
  reward_description text,
  consumer_name     text
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_caller_retailer_id  uuid;
  v_token               redemption_tokens%rowtype;
  v_offer               offers%rowtype;
  v_reward              venue_referral_rewards%rowtype;
  v_cached_status       text;
  v_redemption_id       uuid;
  v_consumer_name       text;
begin
  -- ── Step 0: Idempotency ─────────────────────────────────────────────────────
  select ra.result_status
    into v_cached_status
    from redemption_attempts ra
   where ra.attempt_id = p_redemption_attempt_id;

  if found then
    if v_cached_status = 'success' then
      -- Re-fetch offer title for replay response.
      select o.title into offer_title
        from redemption_attempts ra
        join redemptions r on r.redemption_token_id = ra.redemption_token_id
        join offers o      on o.id = r.offer_id
       where ra.attempt_id = p_redemption_attempt_id
       limit 1;

      valid := true; status := 'success'; rejection_reason := null;
      reward_description := null;
      consumer_name := null;
      return next; return;
    else
      valid := false; status := v_cached_status;
      rejection_reason := 'Cached result from previous attempt.';
      offer_title := null; reward_description := null; consumer_name := null;
      return next; return;
    end if;
  end if;

  -- ── Step 1: Resolve caller's retailer ───────────────────────────────────────
  select ru.retailer_id into v_caller_retailer_id
    from retailer_users ru
   where ru.profile_id = p_retailer_profile_id
     and ru.is_active  = true
   limit 1;

  if v_caller_retailer_id is null then
    valid := false; status := 'rejected';
    rejection_reason := 'Caller is not an active retailer user.';
    offer_title := null; reward_description := null; consumer_name := null;
    return next; return;
  end if;

  -- ── Step 2: Lock and fetch token ────────────────────────────────────────────
  select * into v_token
    from redemption_tokens
   where token_hash = p_token_hash
   for update;

  if not found then
    valid := false; status := 'rejected';
    rejection_reason := 'Token not found.';
    offer_title := null; reward_description := null; consumer_name := null;
    return next; return;
  end if;

  -- ── Step 3: Correct retailer ────────────────────────────────────────────────
  if v_token.retailer_id <> v_caller_retailer_id then
    valid := false; status := 'rejected';
    rejection_reason := 'This QR code was not issued for your retailer.';
    offer_title := null; reward_description := null; consumer_name := null;
    return next; return;
  end if;

  -- ── Step 4: Token not expired ───────────────────────────────────────────────
  if v_token.expires_at < now() then
    valid := false; status := 'expired';
    rejection_reason := 'QR code has expired. Ask the member to refresh.';
    offer_title := null; reward_description := null; consumer_name := null;
    return next; return;
  end if;

  -- ── Step 5: Token not consumed ──────────────────────────────────────────────
  if v_token.consumed_at is not null then
    valid := false; status := 'rejected';
    rejection_reason := 'This QR code has already been used.';
    offer_title := null; reward_description := null; consumer_name := null;
    return next; return;
  end if;

  -- ── Step 6: Membership active ───────────────────────────────────────────────
  if not exists(
    select 1 from consumer_memberships cm
     where cm.profile_id = v_token.profile_id
       and cm.status in ('active','trialing')
       and cm.current_period_end > now()
  ) then
    insert into redemptions(
      profile_id, retailer_id, retailer_location_id, offer_id,
      redemption_token_id, status, rejection_reason, validated_by_profile_id
    ) values (
      v_token.profile_id, v_token.retailer_id, v_token.retailer_location_id,
      v_token.offer_id, v_token.id,
      'membership_invalid', 'Consumer membership is not active.',
      p_retailer_profile_id
    );
    insert into redemption_attempts(attempt_id, redemption_token_id, result_status)
    values (p_redemption_attempt_id, v_token.id, 'membership_invalid');

    valid := false; status := 'membership_invalid';
    rejection_reason := 'This member does not have an active membership.';
    offer_title := null; reward_description := null; consumer_name := null;
    return next; return;
  end if;

  -- ── Step 7: Offer live, correct type, in date window ───────────────────────
  select * into v_offer from offers where id = v_token.offer_id;

  if not found
     or v_offer.offer_type <> 'venue_referral'
     or v_offer.status     <> 'live'
     or v_offer.retailer_id <> v_token.retailer_id
     or (v_offer.start_at is not null and v_offer.start_at > now())
     or (v_offer.end_at   is not null and v_offer.end_at   < now())
  then
    insert into redemptions(
      profile_id, retailer_id, retailer_location_id, offer_id,
      redemption_token_id, status, rejection_reason, validated_by_profile_id
    ) values (
      v_token.profile_id, v_token.retailer_id, v_token.retailer_location_id,
      v_token.offer_id, v_token.id,
      'rejected', 'Offer is no longer available.',
      p_retailer_profile_id
    );
    insert into redemption_attempts(attempt_id, redemption_token_id, result_status)
    values (p_redemption_attempt_id, v_token.id, 'rejected');

    valid := false; status := 'rejected';
    rejection_reason := 'This offer is no longer available.';
    offer_title := null; reward_description := null; consumer_name := null;
    return next; return;
  end if;

  -- ── Step 8: Referrer has an unlocked reward — lock oldest first ─────────────
  select * into v_reward
    from venue_referral_rewards
   where referrer_profile_id = v_token.profile_id
     and offer_id            = v_token.offer_id
     and status              = 'unlocked'
   order by unlocked_at asc
   limit 1
   for update skip locked;

  if not found then
    insert into redemption_attempts(attempt_id, redemption_token_id, result_status)
    values (p_redemption_attempt_id, v_token.id, 'rule_blocked');

    valid := false; status := 'rule_blocked';
    rejection_reason := 'No unlocked referral reward available for this member.';
    offer_title := v_offer.title; reward_description := null; consumer_name := null;
    return next; return;
  end if;

  -- ── Step 9: Consume token, insert redemption, mark reward redeemed ──────────
  update redemption_tokens set consumed_at = now() where id = v_token.id;

  insert into redemptions(
    profile_id, retailer_id, retailer_location_id, offer_id,
    redemption_token_id, status, validated_by_profile_id
  ) values (
    v_token.profile_id, v_token.retailer_id, v_token.retailer_location_id,
    v_token.offer_id, v_token.id,
    'success', p_retailer_profile_id
  ) returning id into v_redemption_id;

  update venue_referral_rewards
     set status       = 'redeemed',
         redeemed_at  = now(),
         redemption_id = v_redemption_id,
         updated_at   = now()
   where id = v_reward.id;

  -- Idempotency record.
  insert into redemption_attempts(attempt_id, redemption_token_id, result_status)
  values (p_redemption_attempt_id, v_token.id, 'success');

  -- Consumer name for scanner display.
  select split_part(p.full_name, ' ', 1) into v_consumer_name
    from profiles p where p.id = v_token.profile_id;

  -- ── Step 10: Return ─────────────────────────────────────────────────────────
  valid := true; status := 'success'; rejection_reason := null;
  offer_title := v_offer.title;
  reward_description := v_offer.description;
  consumer_name := v_consumer_name;
  return next;
end;
$$;

revoke execute on function redeem_venue_referral_reward(text, uuid, uuid) from public;
revoke execute on function redeem_venue_referral_reward(text, uuid, uuid) from anon;
revoke execute on function redeem_venue_referral_reward(text, uuid, uuid) from authenticated;
grant  execute on function redeem_venue_referral_reward(text, uuid, uuid) to service_role;

-- ── get_venue_referral_status ─────────────────────────────────────────────────
-- Lightweight read for the mobile offer detail screen.
-- Returns stats for the calling member on a specific venue_referral offer.

create or replace function get_venue_referral_status(
  p_offer_id   uuid,
  p_profile_id uuid
)
returns table(
  share_token     text,
  invited_count   bigint,
  unlocked_count  bigint,
  redeemed_count  bigint
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
      as redeemed_count;
$$;

grant execute on function get_venue_referral_status(uuid, uuid) to authenticated;

-- ── void_venue_referral_reward (admin action) ─────────────────────────────────
-- Marks a reward as voided. Only affects the reward row; the redemption (if any)
-- is unchanged — the ledger is immutable.

create or replace function void_venue_referral_reward(
  p_reward_id   uuid,
  p_admin_id    uuid,
  p_void_reason text default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update venue_referral_rewards
     set status      = 'voided',
         voided_at   = now(),
         void_reason = p_void_reason,
         voided_by   = p_admin_id,
         updated_at  = now()
   where id = p_reward_id
     and status <> 'voided';

  if not found then
    raise exception 'reward_not_found_or_already_voided';
  end if;
end;
$$;

revoke execute on function void_venue_referral_reward(uuid, uuid, text) from public;
revoke execute on function void_venue_referral_reward(uuid, uuid, text) from anon;
revoke execute on function void_venue_referral_reward(uuid, uuid, text) from authenticated;
grant  execute on function void_venue_referral_reward(uuid, uuid, text) to service_role;
