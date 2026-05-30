-- 058_redeem_offer_via_pass_rpc.sql
-- Retailer-initiated redemption using a consumer's membership pass QR.
--
-- Enables the "scan pass → choose offer" flow introduced in Batch 4.
-- The membership pass token is NOT consumed (it is reusable within its TTL).
-- All offer rule enforcement is identical to redeem_offer_token.
--
-- Schema change: add redemption_id to redemption_attempts so pass-based
-- idempotency reconstruction can join through to the redemptions row
-- (redemption_token_id is NULL for pass-based redemptions).

alter table redemption_attempts
  add column redemption_id uuid references redemptions(id) on delete set null;

comment on column redemption_attempts.redemption_id is
  'For pass-based redemptions (no redemption_token). Used for idempotency cache
   reconstruction when redemption_token_id is NULL.';

-- ── redeem_offer_via_pass ────────────────────────────────────────────────────
-- Called from the retailer portal server action redeemViaPass().
-- Security: only callable by service_role (same as redeem_offer_token).
--
-- Parameters:
--   p_pass_token_hash       — SHA-256 hex of the raw membership pass token
--   p_offer_id              — the offer the retailer has selected
--   p_retailer_profile_id   — auth.uid() of the scanner
--   p_redemption_attempt_id — caller-supplied UUID; reuse on retry for idempotency
--   p_retailer_location_id  — optional; which venue the scan occurred at

create or replace function redeem_offer_via_pass(
  p_pass_token_hash       text,
  p_offer_id              uuid,
  p_retailer_profile_id   uuid,
  p_redemption_attempt_id uuid,
  p_retailer_location_id  uuid default null
)
returns table(
  valid              boolean,
  status             text,
  rejection_reason   text,
  offer_id           uuid,
  retailer_id        uuid,
  offer_title        text,
  benefit_text       text,
  next_available_at  timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_caller_retailer_id  uuid;
  v_pass_token          membership_pass_tokens%rowtype;
  v_consumer_id         uuid;
  v_offer               offers%rowtype;
  v_rules               offer_rules%rowtype;
  v_membership_ok       boolean;
  v_count               integer;
  v_last_redeemed_at    timestamptz;
  v_cooldown_ends_at    timestamptz;
  v_today_start         timestamptz;
  v_tomorrow_start      timestamptz;
  v_current_day         text;
  v_current_time        time;
  v_cached_status       text;
  v_redemption_id       uuid;

  -- Inline helpers to set all output columns and return.
  -- DRY the repeated null-fill pattern.
begin
  -- ── Step 0: Idempotency check ─────────────────────────────────────────────
  select ra.result_status
    into v_cached_status
    from redemption_attempts ra
   where ra.attempt_id = p_redemption_attempt_id;

  if found then
    if v_cached_status = 'success' then
      select r.offer_id, r.retailer_id, o.title, o.value_text
        into offer_id, retailer_id, offer_title, benefit_text
        from redemption_attempts ra
        join redemptions r on r.id = ra.redemption_id
        join offers o on o.id = r.offer_id
       where ra.attempt_id = p_redemption_attempt_id
       limit 1;

      valid             := true;
      status            := 'success';
      rejection_reason  := null;
      next_available_at := null;
    else
      valid             := false;
      status            := v_cached_status;
      rejection_reason  := 'Cached result from previous attempt.';
      next_available_at := null;
      offer_id          := null;
      retailer_id       := null;
      offer_title       := null;
      benefit_text      := null;
    end if;
    return next;
    return;
  end if;

  -- ── Step 1: Resolve caller's retailer ────────────────────────────────────
  select ru.retailer_id
    into v_caller_retailer_id
    from retailer_users ru
   where ru.profile_id = p_retailer_profile_id
     and ru.is_active = true
   limit 1;

  if v_caller_retailer_id is null then
    valid := false; status := 'rejected';
    rejection_reason := 'Caller is not an active retailer user.';
    next_available_at := null; offer_id := null; retailer_id := null; offer_title := null; benefit_text := null;
    return next; return;
  end if;

  -- ── Step 2: Validate pass token ───────────────────────────────────────────
  select *
    into v_pass_token
    from membership_pass_tokens
   where token_hash = p_pass_token_hash;

  if not found then
    valid := false; status := 'rejected';
    rejection_reason := 'Pass token not found.';
    next_available_at := null; offer_id := null; retailer_id := null; offer_title := null; benefit_text := null;
    return next; return;
  end if;

  if v_pass_token.expires_at < now() then
    valid := false; status := 'expired';
    rejection_reason := 'QR code has expired. Ask the member to refresh their app.';
    next_available_at := null; offer_id := null; retailer_id := null; offer_title := null; benefit_text := null;
    return next; return;
  end if;

  v_consumer_id := v_pass_token.profile_id;

  -- ── Step 3: Consumer membership active at scan time ───────────────────────
  select exists(
    select 1 from consumer_memberships cm
     where cm.profile_id = v_consumer_id
       and cm.status in ('active', 'trialing')
       and cm.current_period_end > now()
  ) into v_membership_ok;

  if not v_membership_ok then
    insert into redemption_attempts(attempt_id, redemption_token_id, redemption_id, result_status)
    values (p_redemption_attempt_id, null, null, 'membership_invalid');

    valid := false; status := 'membership_invalid';
    rejection_reason := 'This member does not have an active membership.';
    next_available_at := null; offer_id := null; retailer_id := null; offer_title := null; benefit_text := null;
    return next; return;
  end if;

  -- ── Step 4: Offer live, in window, belongs to caller's retailer ──────────
  select * into v_offer from offers o where o.id = p_offer_id;

  if not found
     or v_offer.status <> 'live'
     or v_offer.retailer_id <> v_caller_retailer_id
     or (v_offer.start_at is not null and v_offer.start_at > now())
     or (v_offer.end_at   is not null and v_offer.end_at   < now())
  then
    insert into redemption_attempts(attempt_id, redemption_token_id, redemption_id, result_status)
    values (p_redemption_attempt_id, null, null, 'rejected');

    valid := false; status := 'rejected';
    rejection_reason := 'Offer is no longer available.';
    next_available_at := null; offer_id := null; retailer_id := null; offer_title := null; benefit_text := null;
    return next; return;
  end if;

  -- ── Step 5: Offer rules ───────────────────────────────────────────────────
  select * into v_rules from offer_rules r where r.offer_id = p_offer_id;

  if found then
    v_today_start    := date_trunc('day', now() at time zone 'UTC') at time zone 'UTC';
    v_tomorrow_start := v_today_start + interval '1 day';

    -- Per-user lifetime cap
    if v_rules.max_redemptions_per_user is not null then
      select count(*) into v_count
        from redemptions r
       where r.offer_id   = p_offer_id
         and r.profile_id = v_consumer_id
         and r.status      = 'success';
      if v_count >= v_rules.max_redemptions_per_user then
        insert into redemption_attempts(attempt_id, redemption_token_id, redemption_id, result_status)
        values (p_redemption_attempt_id, null, null, 'rule_blocked');
        valid := false; status := 'rule_blocked';
        rejection_reason := 'This member has already used this offer the maximum number of times.';
        next_available_at := null; offer_id := null; retailer_id := null; offer_title := null; benefit_text := null;
        return next; return;
      end if;
    end if;

    -- Per-user per-day cap
    if v_rules.max_redemptions_per_day is not null then
      select count(*) into v_count
        from redemptions r
       where r.offer_id    = p_offer_id
         and r.profile_id  = v_consumer_id
         and r.status       = 'success'
         and r.redeemed_at >= v_today_start;
      if v_count >= v_rules.max_redemptions_per_day then
        insert into redemption_attempts(attempt_id, redemption_token_id, redemption_id, result_status)
        values (p_redemption_attempt_id, null, null, 'rule_blocked');
        valid := false; status := 'rule_blocked';
        rejection_reason := 'This member has already used this offer today.';
        next_available_at := v_tomorrow_start;
        offer_id := null; retailer_id := null; offer_title := null; benefit_text := null;
        return next; return;
      end if;
    end if;

    -- Global total cap
    if v_rules.max_redemptions_total is not null then
      select count(*) into v_count
        from redemptions r
       where r.offer_id = p_offer_id
         and r.status    = 'success';
      if v_count >= v_rules.max_redemptions_total then
        insert into redemption_attempts(attempt_id, redemption_token_id, redemption_id, result_status)
        values (p_redemption_attempt_id, null, null, 'rule_blocked');
        valid := false; status := 'rule_blocked';
        rejection_reason := 'This offer has reached its total redemption limit.';
        next_available_at := null; offer_id := null; retailer_id := null; offer_title := null; benefit_text := null;
        return next; return;
      end if;
    end if;

    -- Cooldown between redemptions
    if v_rules.cooldown_hours is not null then
      select r.redeemed_at into v_last_redeemed_at
        from redemptions r
       where r.offer_id   = p_offer_id
         and r.profile_id = v_consumer_id
         and r.status      = 'success'
       order by r.redeemed_at desc
       limit 1;
      if found then
        v_cooldown_ends_at := v_last_redeemed_at + (v_rules.cooldown_hours * interval '1 hour');
        if v_cooldown_ends_at > now() then
          insert into redemption_attempts(attempt_id, redemption_token_id, redemption_id, result_status)
          values (p_redemption_attempt_id, null, null, 'rule_blocked');
          valid := false; status := 'rule_blocked';
          rejection_reason := 'This member must wait before using this offer again.';
          next_available_at := v_cooldown_ends_at;
          offer_id := null; retailer_id := null; offer_title := null; benefit_text := null;
          return next; return;
        end if;
      end if;
    end if;

    -- Day-of-week restriction
    if v_rules.valid_days_json is not null then
      v_current_day := lower(to_char(now() at time zone 'UTC', 'Dy'));
      if not (v_rules.valid_days_json @> jsonb_build_array(v_current_day)) then
        insert into redemption_attempts(attempt_id, redemption_token_id, redemption_id, result_status)
        values (p_redemption_attempt_id, null, null, 'rule_blocked');
        valid := false; status := 'rule_blocked';
        rejection_reason := 'This offer is not available on ' || initcap(v_current_day) || 's.';
        next_available_at := null; offer_id := null; retailer_id := null; offer_title := null; benefit_text := null;
        return next; return;
      end if;
    end if;

    -- Time-of-day restriction
    if v_rules.valid_time_start is not null and v_rules.valid_time_end is not null then
      v_current_time := (now() at time zone 'UTC')::time;
      if v_current_time < v_rules.valid_time_start or v_current_time > v_rules.valid_time_end then
        insert into redemption_attempts(attempt_id, redemption_token_id, redemption_id, result_status)
        values (p_redemption_attempt_id, null, null, 'rule_blocked');
        valid := false; status := 'rule_blocked';
        rejection_reason := 'This offer is only valid between '
                           || left(v_rules.valid_time_start::text, 5)
                           || ' and '
                           || left(v_rules.valid_time_end::text, 5)
                           || ' (UTC).';
        next_available_at := null; offer_id := null; retailer_id := null; offer_title := null; benefit_text := null;
        return next; return;
      end if;
    end if;

    -- New customers only
    if v_rules.new_customers_only then
      select count(*) into v_count
        from redemptions r
       where r.retailer_id = v_caller_retailer_id
         and r.profile_id  = v_consumer_id
         and r.status       = 'success';
      if v_count > 0 then
        insert into redemption_attempts(attempt_id, redemption_token_id, redemption_id, result_status)
        values (p_redemption_attempt_id, null, null, 'rule_blocked');
        valid := false; status := 'rule_blocked';
        rejection_reason := 'This offer is only available to members who have not previously redeemed at this retailer.';
        next_available_at := null; offer_id := null; retailer_id := null; offer_title := null; benefit_text := null;
        return next; return;
      end if;
    end if;

  end if; -- end rules block

  -- ── Step 6: Insert redemption (no redemption_token in pass flow) ──────────
  insert into redemptions(
    profile_id, retailer_id, retailer_location_id, offer_id,
    redemption_token_id, status, validated_by_profile_id
  ) values (
    v_consumer_id,
    v_caller_retailer_id,
    p_retailer_location_id,
    p_offer_id,
    null,          -- pass-based: no redemption token
    'success',
    p_retailer_profile_id
  )
  returning id into v_redemption_id;

  -- ── Step 7: Record attempt for idempotency ────────────────────────────────
  insert into redemption_attempts(attempt_id, redemption_token_id, redemption_id, result_status)
  values (p_redemption_attempt_id, null, v_redemption_id, 'success');

  -- ── Step 8: Return success ────────────────────────────────────────────────
  valid             := true;
  status            := 'success';
  rejection_reason  := null;
  next_available_at := null;
  offer_id          := p_offer_id;
  retailer_id       := v_caller_retailer_id;
  offer_title       := v_offer.title;
  benefit_text      := v_offer.value_text;
  return next;
end;
$$;

-- Only the service role may call this function.
revoke execute on function redeem_offer_via_pass(text, uuid, uuid, uuid, uuid) from public;
revoke execute on function redeem_offer_via_pass(text, uuid, uuid, uuid, uuid) from anon;
revoke execute on function redeem_offer_via_pass(text, uuid, uuid, uuid, uuid) from authenticated;
grant  execute on function redeem_offer_via_pass(text, uuid, uuid, uuid, uuid) to service_role;
