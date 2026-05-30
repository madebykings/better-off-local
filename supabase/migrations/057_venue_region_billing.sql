-- 057_venue_region_billing.sql
-- Per-venue region assignment and billing status.
-- Adds retailer_is_live() and updates get_retailer_offers_availability to use it.
--
-- Grace period on threshold-crossing transition = 30 days.
-- Threshold check uses region_active_member_count (active + trialing).

-- ── Billing status enum ────────────────────────────────────────────────────────

create type venue_billing_status as enum (
  'free_growth_region',  -- region active count < threshold → no charge
  'paid_required',       -- threshold met; payment owed (may be in 30-day grace)
  'paid',                -- Stripe payment confirmed
  'admin_waived',        -- admin override → free regardless of threshold
  'inactive'             -- venue deactivated (soft delete)
);

-- ── retailer_locations additions ───────────────────────────────────────────────

alter table retailer_locations
  add column region_id            uuid references regions(id) on delete set null,
  add column billing_status       venue_billing_status not null default 'free_growth_region',
  add column grace_period_ends_at timestamptz;

create index idx_retailer_locations_region_id
  on retailer_locations(region_id) where region_id is not null;

create index idx_retailer_locations_billing_status
  on retailer_locations(billing_status);

comment on column retailer_locations.region_id is
  'Region this venue belongs to. Explicitly selected by retailer or admin.
   Not inferred from postcode in this version.';
comment on column retailer_locations.billing_status is
  'Billing state for this venue. free_growth_region and admin_waived = no charge.
   paid_required = payment owed (30-day grace may apply). paid = confirmed. inactive = deactivated.';
comment on column retailer_locations.grace_period_ends_at is
  'Set when billing_status transitions free_growth_region → paid_required (region crossed threshold).
   Retailer remains live until this date. Null for new approvals in already-billable regions
   (no grace for new entrants who join after threshold is met).';

-- Back-fill: existing venues default to free_growth_region (no region set yet — admin assigns).
update retailer_locations set billing_status = 'free_growth_region';

-- ── retailer_is_live() ─────────────────────────────────────────────────────────
-- Single authoritative live-check. Replaces the inline subscription check in
-- get_retailer_offers_availability.
--
-- A retailer is live when:
--   approval_status = 'approved' AND visibility_status = 'live' AND is_active = true
--   AND one of the billing conditions holds for the primary venue:
--     A. billing_status = 'free_growth_region'  (region below threshold)
--     B. billing_status = 'admin_waived'        (manual override)
--     C. billing_status = 'paid_required' AND within 30-day grace period
--     D. Active Stripe subscription exists      (threshold met and paid)

create or replace function retailer_is_live(p_retailer_id uuid)
returns boolean
language sql security definer stable set search_path = public, pg_temp as $$
  select exists (
    select 1
      from retailers r
      join retailer_locations rl
        on rl.retailer_id = r.id and rl.is_primary = true
     where r.id = p_retailer_id
       and r.approval_status = 'approved'
       and r.visibility_status = 'live'
       and r.is_active = true
       and (
         rl.billing_status in ('free_growth_region', 'admin_waived')
         or (
           rl.billing_status = 'paid_required'
           and rl.grace_period_ends_at is not null
           and rl.grace_period_ends_at > now()
         )
         or exists (
           select 1 from retailer_subscriptions rs
            where rs.retailer_id = r.id
              and rs.status = 'active'
              and rs.current_period_end > now()
         )
       )
  );
$$;

grant execute on function retailer_is_live(uuid) to authenticated, service_role;

-- ── Updated get_retailer_offers_availability ───────────────────────────────────
-- Reproduced in full from 046_offer_availability_rpcs.sql with only the
-- retailer live-check block replaced (uses retailer_is_live instead of inline
-- subscription check so growth-region retailers are correctly treated as live).

create or replace function get_retailer_offers_availability(
  p_retailer_id uuid,
  p_consumer_id uuid
)
returns table(
  offer_id           uuid,
  availability_state text,
  available_at       timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_retailer_live               boolean;
  v_max_day_offers              integer;
  v_retailer_cap_reached        boolean;
  v_today_retailer_count        integer;
  v_offer                       offers%rowtype;
  v_rules                       offer_rules%rowtype;
  v_rules_found                 boolean;
  v_has_membership              boolean;
  v_count                       integer;
  v_last_redeemed_at            timestamptz;
  v_cooldown_ends_at            timestamptz;
  v_today_start                 timestamptz;
  v_tomorrow_start              timestamptz;
  v_current_day                 text;
  v_current_time                time;
  v_next_valid                  timestamptz;
  v_check_day                   text;
  v_i                           integer;
  v_next_window                 timestamptz;
begin
  -- ── Retailer live check (UPDATED: delegates to retailer_is_live) ─────────────
  select
    retailer_is_live(p_retailer_id),
    r.max_offers_per_retailer_per_day
  into v_retailer_live, v_max_day_offers
  from retailers r
  where r.id = p_retailer_id;

  if v_retailer_live is null then
    return;
  end if;

  -- ── Shared time values ────────────────────────────────────────────────────────
  v_today_start    := date_trunc('day', now() at time zone 'UTC') at time zone 'UTC';
  v_tomorrow_start := v_today_start + interval '1 day';
  v_current_day    := lower(to_char(now() at time zone 'UTC', 'Dy'));
  v_current_time   := (now() at time zone 'UTC')::time;

  -- ── Consumer membership check ─────────────────────────────────────────────────
  if p_consumer_id is not null then
    select exists(
      select 1
        from consumer_memberships cm
       where cm.profile_id = p_consumer_id
         and cm.status in ('active', 'trialing')
         and cm.current_period_end > now()
    ) into v_has_membership;
  else
    v_has_membership := false;
  end if;

  -- ── Retailer daily cross-offer cap check ──────────────────────────────────────
  if v_max_day_offers is not null
     and p_consumer_id is not null
     and v_has_membership
  then
    select count(*) into v_today_retailer_count
      from redemptions r
     where r.retailer_id  = p_retailer_id
       and r.profile_id   = p_consumer_id
       and r.status       = 'success'
       and r.redeemed_at >= v_today_start;

    v_retailer_cap_reached := (v_today_retailer_count >= v_max_day_offers);
  else
    v_retailer_cap_reached := false;
  end if;

  -- ── Per-offer loop ────────────────────────────────────────────────────────────
  for v_offer in
    select *
      from offers o
     where o.retailer_id = p_retailer_id
       and o.status in ('live', 'expired')
     order by o.is_featured desc, o.created_at asc
  loop
    offer_id := v_offer.id;

    if not v_retailer_live then
      availability_state := 'retailer_inactive';
      available_at       := null;
      return next;
      continue;
    end if;

    if v_offer.status = 'expired'
       or (v_offer.end_at is not null and v_offer.end_at < now())
    then
      availability_state := 'offer_expired';
      available_at       := null;
      return next;
      continue;
    end if;

    if v_offer.start_at is not null and v_offer.start_at > now() then
      availability_state := 'offer_not_started';
      available_at       := v_offer.start_at;
      return next;
      continue;
    end if;

    select * into v_rules
      from offer_rules r
     where r.offer_id = v_offer.id;
    v_rules_found := found;

    if v_rules_found and v_rules.max_redemptions_total is not null then
      select count(*) into v_count
        from redemptions r
       where r.offer_id = v_offer.id
         and r.status   = 'success';

      if v_count >= v_rules.max_redemptions_total then
        availability_state := 'total_cap_reached';
        available_at       := null;
        return next;
        continue;
      end if;
    end if;

    if not v_has_membership then
      availability_state := 'requires_membership';
      available_at       := null;
      return next;
      continue;
    end if;

    if v_retailer_cap_reached then
      availability_state := 'retailer_daily_cap_reached';
      available_at       := v_tomorrow_start;
      return next;
      continue;
    end if;

    if v_rules_found then

      if v_rules.max_redemptions_per_user is not null then
        select count(*) into v_count
          from redemptions r
         where r.offer_id   = v_offer.id
           and r.profile_id = p_consumer_id
           and r.status     = 'success';

        if v_count >= v_rules.max_redemptions_per_user then
          availability_state := 'lifetime_used';
          available_at       := null;
          return next;
          continue;
        end if;
      end if;

      if v_rules.cooldown_hours is not null then
        select r.redeemed_at into v_last_redeemed_at
          from redemptions r
         where r.offer_id   = v_offer.id
           and r.profile_id = p_consumer_id
           and r.status     = 'success'
         order by r.redeemed_at desc
         limit 1;

        if found then
          v_cooldown_ends_at := v_last_redeemed_at
                              + (v_rules.cooldown_hours * interval '1 hour');

          if v_cooldown_ends_at > now() then
            availability_state := 'cooldown';
            available_at       := v_cooldown_ends_at;
            return next;
            continue;
          end if;
        end if;
      end if;

      if v_rules.max_redemptions_per_day is not null then
        select count(*) into v_count
          from redemptions r
         where r.offer_id    = v_offer.id
           and r.profile_id  = p_consumer_id
           and r.status      = 'success'
           and r.redeemed_at >= v_today_start;

        if v_count >= v_rules.max_redemptions_per_day then
          availability_state := 'daily_cap_reached';
          available_at       := v_tomorrow_start;
          return next;
          continue;
        end if;
      end if;

      if v_rules.valid_days_json is not null then
        if not (v_rules.valid_days_json @> jsonb_build_array(v_current_day)) then
          v_next_valid := null;
          for v_i in 1..7 loop
            v_check_day := lower(to_char(
              (now() at time zone 'UTC') + (v_i * interval '1 day'), 'Dy'
            ));
            if v_rules.valid_days_json @> jsonb_build_array(v_check_day) then
              v_next_valid :=
                date_trunc('day',
                  (now() at time zone 'UTC') + (v_i * interval '1 day')
                ) at time zone 'UTC';
              exit;
            end if;
          end loop;

          availability_state := 'day_restricted';
          available_at       := v_next_valid;
          return next;
          continue;
        end if;
      end if;

      if v_rules.valid_time_start is not null
         and v_rules.valid_time_end is not null
      then
        if v_current_time < v_rules.valid_time_start
           or v_current_time > v_rules.valid_time_end
        then
          if v_current_time < v_rules.valid_time_start then
            v_next_window :=
              (v_today_start::date + v_rules.valid_time_start) at time zone 'UTC';
          else
            v_next_window :=
              (v_tomorrow_start::date + v_rules.valid_time_start) at time zone 'UTC';
          end if;

          availability_state := 'time_restricted';
          available_at       := v_next_window;
          return next;
          continue;
        end if;
      end if;

      if v_rules.new_customers_only then
        select count(*) into v_count
          from redemptions r
         where r.retailer_id = p_retailer_id
           and r.profile_id  = p_consumer_id
           and r.status      = 'success';

        if v_count > 0 then
          availability_state := 'new_customers_only';
          available_at       := null;
          return next;
          continue;
        end if;
      end if;

    end if;

    availability_state := 'available';
    available_at       := null;
    return next;

  end loop;
end;
$$;

grant execute on function get_retailer_offers_availability(uuid, uuid) to authenticated;
grant execute on function get_offer_availability(uuid, uuid)           to authenticated;
revoke execute on function get_retailer_offers_availability(uuid, uuid) from anon;
revoke execute on function get_offer_availability(uuid, uuid)           from anon;

-- ── Grants for new tables ──────────────────────────────────────────────────────
grant select on regions to authenticated, anon;
grant all    on regions to service_role;

-- ── Region member-count functions ─────────────────────────────────────────────
-- Moved here from 055_regions.sql because both functions reference
-- profiles.region_id (added in 056) and the view below references
-- retailer_locations.region_id (added above in this migration).
-- Defining them in 055 caused "column does not exist" errors during db push.

-- Active members (active + trialing) — used for threshold decisions.
create or replace function region_active_member_count(p_region_id uuid)
returns integer
language sql security definer stable set search_path = public, pg_temp as $$
  select count(*)::integer
  from profiles p
  join consumer_memberships cm on cm.profile_id = p.id
  where p.region_id = p_region_id
    and cm.status in ('active', 'trialing')
    and cm.current_period_end > now();
$$;

-- Paying members (active only, no trials) — reporting and dashboard display.
create or replace function region_paying_member_count(p_region_id uuid)
returns integer
language sql security definer stable set search_path = public, pg_temp as $$
  select count(*)::integer
  from profiles p
  join consumer_memberships cm on cm.profile_id = p.id
  where p.region_id = p_region_id
    and cm.status = 'active'
    and cm.current_period_end > now();
$$;

grant execute on function region_active_member_count(uuid) to authenticated, service_role;
grant execute on function region_paying_member_count(uuid) to authenticated, service_role;

-- ── region_public_stats view ──────────────────────────────────────────────────
-- Also moved here from 055: the subqueries below join retailer_locations on
-- rl.region_id which is only added to that table above in this migration.

create or replace view region_public_stats as
  select
    r.id,
    r.name,
    r.slug,
    r.country,
    r.member_threshold,
    r.is_active,
    region_active_member_count(r.id)  as active_member_count,
    region_paying_member_count(r.id)  as paying_member_count,
    (
      select count(*)::integer
        from retailers ret
        join retailer_locations rl
          on rl.retailer_id = ret.id and rl.is_primary = true
       where rl.region_id = r.id
         and ret.approval_status = 'approved'
         and ret.visibility_status = 'live'
         and ret.is_active = true
    ) as active_retailer_count,
    (
      select count(*)::integer
        from offers o
        join retailers ret on ret.id = o.retailer_id
        join retailer_locations rl
          on rl.retailer_id = ret.id and rl.is_primary = true
       where rl.region_id = r.id
         and o.status = 'live'
    ) as live_offer_count
  from regions r;

-- Internal grant; anon access added in 061 when the public progress page ships.
grant select on region_public_stats to service_role, authenticated;
