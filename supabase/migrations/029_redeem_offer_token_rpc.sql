-- 029_redeem_offer_token_rpc.sql
-- Atomic offer redemption via a single Postgres RPC.
--
-- Replaces the sequential UPDATE + INSERT steps in the validate-qr-token edge
-- function with a single transaction. If any step fails, the entire transaction
-- rolls back — consumed_at reverts to NULL and no orphaned tokens are left.
--
-- Also introduces redemption_attempts for idempotency: the scanner generates a
-- UUID before each scan and retries with the same UUID. Duplicate attempts return
-- the cached result without reprocessing.
--
-- Usage (from edge function):
--   supabase.rpc('redeem_offer_token', {
--     p_token_hash:            '<sha256 hex>',
--     p_retailer_profile_id:   '<uuid>',
--     p_redemption_attempt_id: '<uuid>',
--   })
-- Returns a single row from the RETURNS TABLE definition below.

-- ── Idempotency store ────────────────────────────────────────────────────────
-- Stores transport/retry state, separate from the redemptions business ledger.
create table redemption_attempts (
  attempt_id          uuid        primary key,
  redemption_token_id uuid        references redemption_tokens(id) on delete set null,
  result_status       text        not null,
  created_at          timestamptz not null default now()
);

create index redemption_attempts_token_idx on redemption_attempts(redemption_token_id);

-- ── RPC function ─────────────────────────────────────────────────────────────
create or replace function redeem_offer_token(
  p_token_hash              text,
  p_retailer_profile_id     uuid,
  p_redemption_attempt_id   uuid
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
  v_token               redemption_tokens%rowtype;
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
  v_validated_by        uuid;
begin
  -- ── Step 0: Idempotency check ─────────────────────────────────────────────
  -- If this attempt_id was seen before, return the cached result immediately.
  select ra.result_status
    into v_cached_status
    from redemption_attempts ra
   where ra.attempt_id = p_redemption_attempt_id;

  if found then
    -- Reconstruct a minimal success row for cached successful attempts,
    -- or a rejection row for cached failures. next_available_at is not stored
    -- so it is returned as NULL on replayed responses.
    if v_cached_status = 'success' then
      select r.offer_id, r.retailer_id, o.title, o.value_text
        into offer_id, retailer_id, offer_title, benefit_text
        from redemption_attempts ra
        join redemptions r on r.redemption_token_id = ra.redemption_token_id
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
    valid             := false;
    status            := 'rejected';
    rejection_reason  := 'Caller is not an active retailer user.';
    next_available_at := null;
    offer_id          := null;
    retailer_id       := null;
    offer_title       := null;
    benefit_text      := null;
    return next;
    return;
  end if;

  -- ── Step 2: Lock and fetch token (SELECT … FOR UPDATE) ───────────────────
  -- Acquires a row-level lock for the duration of this transaction.
  -- A concurrent scan of the same token will block here until this transaction
  -- commits, then see consumed_at IS NOT NULL and reject cleanly.
  select *
    into v_token
    from redemption_tokens
   where token_hash = p_token_hash
     for update;

  if not found then
    valid             := false;
    status            := 'rejected';
    rejection_reason  := 'Token not found.';
    next_available_at := null;
    offer_id          := null;
    retailer_id       := null;
    offer_title       := null;
    benefit_text      := null;
    return next;
    return;
  end if;

  -- ── Step 3: Correct retailer ──────────────────────────────────────────────
  if v_token.retailer_id <> v_caller_retailer_id then
    valid             := false;
    status            := 'rejected';
    rejection_reason  := 'This QR code was not issued for your retailer.';
    next_available_at := null;
    offer_id          := null;
    retailer_id       := null;
    offer_title       := null;
    benefit_text      := null;
    return next;
    return;
  end if;

  -- ── Step 4: Token not expired ─────────────────────────────────────────────
  if v_token.expires_at < now() then
    valid             := false;
    status            := 'expired';
    rejection_reason  := 'QR code has expired. Ask the member to refresh.';
    next_available_at := null;
    offer_id          := null;
    retailer_id       := null;
    offer_title       := null;
    benefit_text      := null;
    return next;
    return;
  end if;

  -- ── Step 5: Not already consumed ─────────────────────────────────────────
  -- FOR UPDATE lock means we won the race; if consumed_at is set, a prior
  -- transaction already committed a successful redemption.
  if v_token.consumed_at is not null then
    valid             := false;
    status            := 'rejected';
    rejection_reason  := 'This QR code has already been used.';
    next_available_at := null;
    offer_id          := null;
    retailer_id       := null;
    offer_title       := null;
    benefit_text      := null;
    return next;
    return;
  end if;

  -- ── Step 6: Consumer membership active at scan time ──────────────────────
  select exists(
    select 1
      from consumer_memberships cm
     where cm.profile_id = v_token.profile_id
       and cm.status in ('active', 'trialing')
       and cm.current_period_end > now()
  ) into v_membership_ok;

  if not v_membership_ok then
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

    valid             := false;
    status            := 'membership_invalid';
    rejection_reason  := 'This member does not have an active membership.';
    next_available_at := null;
    offer_id          := null;
    retailer_id       := null;
    offer_title       := null;
    benefit_text      := null;
    return next;
    return;
  end if;

  -- ── Step 7: Offer still live and belongs to this retailer ─────────────────
  select *
    into v_offer
    from offers o
   where o.id = v_token.offer_id;

  if not found
     or v_offer.status <> 'live'
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

    valid             := false;
    status            := 'rejected';
    rejection_reason  := 'This offer is no longer available.';
    next_available_at := null;
    offer_id          := null;
    retailer_id       := null;
    offer_title       := null;
    benefit_text      := null;
    return next;
    return;
  end if;

  -- ── Step 8: Offer rules re-validated at scan time ────────────────────────
  select *
    into v_rules
    from offer_rules r
   where r.offer_id = v_token.offer_id;

  if found then

    -- Per-user lifetime cap
    if v_rules.max_redemptions_per_user is not null then
      select count(*) into v_count
        from redemptions r
       where r.offer_id   = v_token.offer_id
         and r.profile_id = v_token.profile_id
         and r.status      = 'success';

      if v_count >= v_rules.max_redemptions_per_user then
        insert into redemptions(
          profile_id, retailer_id, retailer_location_id, offer_id,
          redemption_token_id, status, rejection_reason, validated_by_profile_id
        ) values (
          v_token.profile_id, v_token.retailer_id, v_token.retailer_location_id,
          v_token.offer_id, v_token.id,
          'rule_blocked', 'Per-user redemption limit reached.',
          p_retailer_profile_id
        );

        insert into redemption_attempts(attempt_id, redemption_token_id, result_status)
        values (p_redemption_attempt_id, v_token.id, 'rule_blocked');

        valid             := false;
        status            := 'rule_blocked';
        rejection_reason  := 'This member has already used this offer the maximum number of times.';
        next_available_at := null;
        offer_id          := null;
        retailer_id       := null;
        offer_title       := null;
        benefit_text      := null;
        return next;
        return;
      end if;
    end if;

    -- Per-user per-day cap
    if v_rules.max_redemptions_per_day is not null then
      v_today_start    := date_trunc('day', now() at time zone 'UTC') at time zone 'UTC';
      v_tomorrow_start := v_today_start + interval '1 day';

      select count(*) into v_count
        from redemptions r
       where r.offer_id    = v_token.offer_id
         and r.profile_id  = v_token.profile_id
         and r.status       = 'success'
         and r.redeemed_at >= v_today_start;

      if v_count >= v_rules.max_redemptions_per_day then
        insert into redemptions(
          profile_id, retailer_id, retailer_location_id, offer_id,
          redemption_token_id, status, rejection_reason, validated_by_profile_id
        ) values (
          v_token.profile_id, v_token.retailer_id, v_token.retailer_location_id,
          v_token.offer_id, v_token.id,
          'rule_blocked', 'Daily redemption limit reached.',
          p_retailer_profile_id
        );

        insert into redemption_attempts(attempt_id, redemption_token_id, result_status)
        values (p_redemption_attempt_id, v_token.id, 'rule_blocked');

        valid             := false;
        status            := 'rule_blocked';
        rejection_reason  := 'This member has already used this offer today.';
        next_available_at := v_tomorrow_start;
        offer_id          := null;
        retailer_id       := null;
        offer_title       := null;
        benefit_text      := null;
        return next;
        return;
      end if;
    end if;

    -- Global total cap across all users
    if v_rules.max_redemptions_total is not null then
      select count(*) into v_count
        from redemptions r
       where r.offer_id = v_token.offer_id
         and r.status    = 'success';

      if v_count >= v_rules.max_redemptions_total then
        insert into redemptions(
          profile_id, retailer_id, retailer_location_id, offer_id,
          redemption_token_id, status, rejection_reason, validated_by_profile_id
        ) values (
          v_token.profile_id, v_token.retailer_id, v_token.retailer_location_id,
          v_token.offer_id, v_token.id,
          'rule_blocked', 'Offer total redemption cap reached.',
          p_retailer_profile_id
        );

        insert into redemption_attempts(attempt_id, redemption_token_id, result_status)
        values (p_redemption_attempt_id, v_token.id, 'rule_blocked');

        valid             := false;
        status            := 'rule_blocked';
        rejection_reason  := 'This offer has reached its total redemption limit.';
        next_available_at := null;
        offer_id          := null;
        retailer_id       := null;
        offer_title       := null;
        benefit_text      := null;
        return next;
        return;
      end if;
    end if;

    -- Cooldown between redemptions for the same user
    if v_rules.cooldown_hours is not null then
      select r.redeemed_at into v_last_redeemed_at
        from redemptions r
       where r.offer_id   = v_token.offer_id
         and r.profile_id = v_token.profile_id
         and r.status      = 'success'
       order by r.redeemed_at desc
       limit 1;

      if found then
        v_cooldown_ends_at := v_last_redeemed_at + (v_rules.cooldown_hours * interval '1 hour');

        if v_cooldown_ends_at > now() then
          insert into redemptions(
            profile_id, retailer_id, retailer_location_id, offer_id,
            redemption_token_id, status, rejection_reason, validated_by_profile_id
          ) values (
            v_token.profile_id, v_token.retailer_id, v_token.retailer_location_id,
            v_token.offer_id, v_token.id,
            'rule_blocked', 'Cooldown period not yet elapsed.',
            p_retailer_profile_id
          );

          insert into redemption_attempts(attempt_id, redemption_token_id, result_status)
          values (p_redemption_attempt_id, v_token.id, 'rule_blocked');

          valid             := false;
          status            := 'rule_blocked';
          rejection_reason  := 'This member must wait before using this offer again.';
          next_available_at := v_cooldown_ends_at;
          offer_id          := null;
          retailer_id       := null;
          offer_title       := null;
          benefit_text      := null;
          return next;
          return;
        end if;
      end if;
    end if;

    -- Valid days of the week
    if v_rules.valid_days_json is not null then
      v_current_day := lower(to_char(now() at time zone 'UTC', 'Dy'));
      -- to_char 'Dy' → 'Mon', 'Tue', etc. lower() → 'mon', 'tue'

      if not (v_rules.valid_days_json @> jsonb_build_array(v_current_day)) then
        insert into redemptions(
          profile_id, retailer_id, retailer_location_id, offer_id,
          redemption_token_id, status, rejection_reason, validated_by_profile_id
        ) values (
          v_token.profile_id, v_token.retailer_id, v_token.retailer_location_id,
          v_token.offer_id, v_token.id,
          'rule_blocked', 'Offer not valid on ' || initcap(v_current_day) || 's.',
          p_retailer_profile_id
        );

        insert into redemption_attempts(attempt_id, redemption_token_id, result_status)
        values (p_redemption_attempt_id, v_token.id, 'rule_blocked');

        valid             := false;
        status            := 'rule_blocked';
        rejection_reason  := 'This offer is not available on ' || initcap(v_current_day) || 's.';
        next_available_at := null;
        offer_id          := null;
        retailer_id       := null;
        offer_title       := null;
        benefit_text      := null;
        return next;
        return;
      end if;
    end if;

    -- Valid time window
    if v_rules.valid_time_start is not null and v_rules.valid_time_end is not null then
      v_current_time := (now() at time zone 'UTC')::time;

      if v_current_time < v_rules.valid_time_start or v_current_time > v_rules.valid_time_end then
        insert into redemptions(
          profile_id, retailer_id, retailer_location_id, offer_id,
          redemption_token_id, status, rejection_reason, validated_by_profile_id
        ) values (
          v_token.profile_id, v_token.retailer_id, v_token.retailer_location_id,
          v_token.offer_id, v_token.id,
          'rule_blocked',
          'Offer only valid ' || v_rules.valid_time_start::text || '–' || v_rules.valid_time_end::text || ' UTC.',
          p_retailer_profile_id
        );

        insert into redemption_attempts(attempt_id, redemption_token_id, result_status)
        values (p_redemption_attempt_id, v_token.id, 'rule_blocked');

        valid             := false;
        status            := 'rule_blocked';
        rejection_reason  := 'This offer is only valid between '
                             || left(v_rules.valid_time_start::text, 5)
                             || ' and '
                             || left(v_rules.valid_time_end::text, 5)
                             || ' (UTC).';
        next_available_at := null;
        offer_id          := null;
        retailer_id       := null;
        offer_title       := null;
        benefit_text      := null;
        return next;
        return;
      end if;
    end if;

  end if; -- end rules block

  -- ── Step 9: Consume token ─────────────────────────────────────────────────
  -- FOR UPDATE lock is already held; no WHERE IS NULL guard needed.
  -- If this UPDATE or either INSERT below fails, the transaction rolls back
  -- and consumed_at stays NULL — no orphaned tokens.
  update redemption_tokens
     set consumed_at = now()
   where id = v_token.id;

  -- ── Step 10: Record redemption ────────────────────────────────────────────
  insert into redemptions(
    profile_id, retailer_id, retailer_location_id, offer_id,
    redemption_token_id, status, validated_by_profile_id
  ) values (
    v_token.profile_id, v_token.retailer_id, v_token.retailer_location_id,
    v_token.offer_id, v_token.id,
    'success',
    p_retailer_profile_id
  )
  returning id into v_redemption_id;

  -- ── Step 11: Record attempt for idempotency ───────────────────────────────
  insert into redemption_attempts(attempt_id, redemption_token_id, result_status)
  values (p_redemption_attempt_id, v_token.id, 'success');

  -- ── Step 12: Return success ───────────────────────────────────────────────
  valid             := true;
  status            := 'success';
  rejection_reason  := null;
  next_available_at := null;
  offer_id          := v_token.offer_id;
  retailer_id       := v_token.retailer_id;
  offer_title       := v_offer.title;
  benefit_text      := v_offer.value_text;
  return next;
end;
$$;

-- Only the service role (used by edge functions) may call this function.
-- RLS on the underlying tables provides the second layer of defence.
revoke execute on function redeem_offer_token(text, uuid, uuid) from public;
revoke execute on function redeem_offer_token(text, uuid, uuid) from anon;
revoke execute on function redeem_offer_token(text, uuid, uuid) from authenticated;
grant  execute on function redeem_offer_token(text, uuid, uuid) to service_role;
