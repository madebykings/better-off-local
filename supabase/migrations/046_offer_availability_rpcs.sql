-- 046_offer_availability_rpcs.sql
-- Server-authoritative offer availability for Flutter.
-- Flutter must not compute availability from local state.
--
-- Actual offer_rules column names (verified from 009_offer_rules.sql):
--   max_redemptions_total     — global cap across all users
--   max_redemptions_per_user  — per-user lifetime cap
--   max_redemptions_per_day   — per-user per-day cap
--   cooldown_hours            — hours between redemptions per user
--   valid_days_json           — jsonb array of allowed weekday codes e.g. ["mon","tue"]
--   valid_time_start / valid_time_end — time window restriction
--   new_customers_only        — boolean
-- No max_per_week or max_per_month columns exist.
--
-- Availability states (priority order, first match wins):
--   retailer_inactive       — retailer not live or no active subscription
--   offer_expired           — offer.status = expired or end_at passed
--   offer_not_started       — offer.start_at in the future
--   total_cap_reached       — global redemption cap hit
--   requires_membership     — consumer has no active membership
--   retailer_daily_cap_reached — max_offers_per_retailer_per_day hit for today
--   lifetime_used           — per-user lifetime cap hit
--   cooldown                — cooldown_hours not yet elapsed since last use
--   daily_cap_reached       — per-user per-day cap hit
--   day_restricted          — valid_days_json excludes today
--   time_restricted         — valid_time_start/end window not active
--   new_customers_only      — offer is for new customers; consumer has prior redemption here
--   available               — no restriction applies
--
-- available_at: non-null when the state has a calculable reset time.
--   offer_not_started       → offer.start_at
--   retailer_daily_cap_reached / daily_cap_reached → start of tomorrow (UTC)
--   cooldown                → last_redeemed_at + cooldown_hours
--   day_restricted          → start of next valid day (UTC midnight)
--   time_restricted         → today or tomorrow at valid_time_start (UTC)
--   all others              → null

-- ── get_retailer_offers_availability ─────────────────────────────────────────
-- Returns one row per offer for the given retailer.
-- Excludes draft/pending/rejected offers (not consumer-facing).
-- Ordered: featured first, then by created_at asc.
-- p_consumer_id may be null for unauthenticated browsing;
-- requires_membership will be returned for all offers in that case.

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
  -- ── Retailer live check ───────────────────────────────────────────────────
  -- A retailer is live when all three conditions hold:
  --   1. retailers.visibility_status = 'live'
  --   2. retailers.is_active = true
  --   3. An active subscription exists (status='active', current_period_end future)
  select (
    r.visibility_status = 'live'
    and r.is_active = true
    and exists (
      select 1
        from retailer_subscriptions rs
       where rs.retailer_id = r.id
         and rs.status = 'active'
         and rs.current_period_end > now()
    )
  ),
  r.max_offers_per_retailer_per_day
  into v_retailer_live, v_max_day_offers
  from retailers r
  where r.id = p_retailer_id;

  if v_retailer_live is null then
    return; -- retailer not found; return empty result set
  end if;

  -- ── Shared time values (computed once for consistent results per call) ────
  v_today_start    := date_trunc('day', now() at time zone 'UTC') at time zone 'UTC';
  v_tomorrow_start := v_today_start + interval '1 day';
  v_current_day    := lower(to_char(now() at time zone 'UTC', 'Dy'));
  v_current_time   := (now() at time zone 'UTC')::time;

  -- ── Consumer membership check (once per call, not per offer) ─────────────
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

  -- ── Retailer daily cross-offer cap check (once per call) ─────────────────
  -- Only relevant when max_offers_per_retailer_per_day is set and consumer
  -- is a member (non-members can't redeem; cap is irrelevant for them).
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

  -- ── Per-offer loop ────────────────────────────────────────────────────────
  for v_offer in
    select *
      from offers o
     where o.retailer_id = p_retailer_id
       and o.status in ('live', 'expired')
     order by o.is_featured desc, o.created_at asc
  loop
    offer_id := v_offer.id;

    -- 1. Retailer inactive
    if not v_retailer_live then
      availability_state := 'retailer_inactive';
      available_at       := null;
      return next;
      continue;
    end if;

    -- 2. Offer expired (status flag OR end_at passed)
    if v_offer.status = 'expired'
       or (v_offer.end_at is not null and v_offer.end_at < now())
    then
      availability_state := 'offer_expired';
      available_at       := null;
      return next;
      continue;
    end if;

    -- 3. Offer not started
    if v_offer.start_at is not null and v_offer.start_at > now() then
      availability_state := 'offer_not_started';
      available_at       := v_offer.start_at;
      return next;
      continue;
    end if;

    -- Fetch offer rules (one row max due to unique(offer_id) constraint)
    select * into v_rules
      from offer_rules r
     where r.offer_id = v_offer.id;
    v_rules_found := found;

    -- 4. Total global cap reached
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

    -- 5. Consumer requires membership
    if not v_has_membership then
      availability_state := 'requires_membership';
      available_at       := null;
      return next;
      continue;
    end if;

    -- 6. Retailer daily cross-offer cap
    if v_retailer_cap_reached then
      availability_state := 'retailer_daily_cap_reached';
      available_at       := v_tomorrow_start;
      return next;
      continue;
    end if;

    -- Rules checks (per-user, only relevant when rules exist)
    if v_rules_found then

      -- 7. Per-user lifetime cap
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

      -- 8. Cooldown between redemptions
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

      -- 9. Per-user per-day cap
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

      -- 10. Day-of-week restriction
      -- valid_days_json holds lowercase 3-char codes matching to_char 'Dy' output:
      -- 'mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'
      if v_rules.valid_days_json is not null then
        if not (v_rules.valid_days_json @> jsonb_build_array(v_current_day)) then
          -- Find the start of the next valid day (look ahead up to 7 days)
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

      -- 11. Time-of-day restriction
      if v_rules.valid_time_start is not null
         and v_rules.valid_time_end is not null
      then
        if v_current_time < v_rules.valid_time_start
           or v_current_time > v_rules.valid_time_end
        then
          -- available_at = today at valid_time_start if we haven't reached it yet,
          -- otherwise tomorrow at valid_time_start.
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

      -- 12. New customers only
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

    end if; -- v_rules_found

    -- 13. Available
    availability_state := 'available';
    available_at       := null;
    return next;

  end loop;
end;
$$;

-- ── get_offer_availability ────────────────────────────────────────────────────
-- Single-offer variant. Used as the final server-side gate before issuing
-- a redemption_token. If state is not 'available', token generation is refused.
-- Delegates to get_retailer_offers_availability to avoid logic duplication.

create or replace function get_offer_availability(
  p_offer_id    uuid,
  p_consumer_id uuid
)
returns table(
  availability_state text,
  available_at       timestamptz
)
language sql
security definer
set search_path = public, pg_temp
as $$
  select a.availability_state, a.available_at
    from get_retailer_offers_availability(
      (select retailer_id from offers where id = p_offer_id),
      p_consumer_id
    ) a
   where a.offer_id = p_offer_id;
$$;

-- ── Grants ────────────────────────────────────────────────────────────────────
-- Callable by authenticated users (Flutter consumers and retailer portal).
-- SECURITY DEFINER means the function runs with owner privileges and can
-- read consumer_memberships and redemptions without the caller needing
-- direct table access. Authorization decisions are made inside the functions.

grant execute on function get_retailer_offers_availability(uuid, uuid) to authenticated;
grant execute on function get_offer_availability(uuid, uuid)           to authenticated;

-- Revoke from anon — availability checks require knowing who the consumer is.
-- Unauthenticated browsing passes p_consumer_id = null explicitly.
revoke execute on function get_retailer_offers_availability(uuid, uuid) from anon;
revoke execute on function get_offer_availability(uuid, uuid)           from anon;
