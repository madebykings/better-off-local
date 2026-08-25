-- 110_free_consumer_tier.sql
-- Consumer tier is free while the product establishes its user base.
-- Paid consumer tiers are planned for a future release.
--
-- Changes:
--   1. get_retailer_offers_availability: membership check made dormant —
--      all authenticated consumers (p_consumer_id IS NOT NULL) are treated
--      as members. The `requires_membership` availability state is preserved
--      for unauthenticated browsing (p_consumer_id = null), where it correctly
--      signals that sign-in is required to redeem.
--
-- To reactivate paid consumer gating, restore the consumer_memberships query
-- in the section marked DORMANT below.

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
    return;
  end if;

  -- ── Shared time values ────────────────────────────────────────────────────
  v_today_start    := date_trunc('day', now() at time zone 'UTC') at time zone 'UTC';
  v_tomorrow_start := v_today_start + interval '1 day';
  v_current_day    := lower(to_char(now() at time zone 'UTC', 'Dy'));
  v_current_time   := (now() at time zone 'UTC')::time;

  -- ── Consumer membership check — DORMANT (free consumer tier) ─────────────
  -- All authenticated consumers are treated as members.
  -- Restore the consumer_memberships query when paid tiers are introduced:
  --
  -- if p_consumer_id is not null then
  --   select exists(
  --     select 1
  --       from consumer_memberships cm
  --      where cm.profile_id = p_consumer_id
  --        and cm.status in ('active', 'trialing')
  --        and cm.current_period_end > now()
  --   ) into v_has_membership;
  -- else
  --   v_has_membership := false;
  -- end if;
  --
  -- For now: authenticated = member; unauthenticated = not a member.
  v_has_membership := (p_consumer_id is not null);

  -- ── Retailer daily cross-offer cap check ──────────────────────────────────
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

    -- 2. Offer expired
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

    -- Fetch offer rules
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

    -- 5. Consumer requires membership (unauthenticated browsing only)
    -- When consumer tiers are paid, this also fires for non-members.
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

      -- 11. Time-of-day restriction
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

-- ── redeem_offer_token — membership check dormant ─────────────────────────────
-- Only Step 6 changes: v_membership_ok is always true for the free consumer tier.
-- All other logic (idempotency, locks, caps, rules) is identical to migration 029.

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
  -- Step 0: Idempotency
  select ra.result_status into v_cached_status
    from redemption_attempts ra
   where ra.attempt_id = p_redemption_attempt_id;

  if found then
    if v_cached_status = 'success' then
      select r.offer_id, r.retailer_id, o.title, o.value_text
        into offer_id, retailer_id, offer_title, benefit_text
        from redemption_attempts ra
        join redemptions r on r.redemption_token_id = ra.redemption_token_id
        join offers o on o.id = r.offer_id
       where ra.attempt_id = p_redemption_attempt_id
       limit 1;
      valid := true; status := 'success'; rejection_reason := null; next_available_at := null;
    else
      valid := false; status := v_cached_status;
      rejection_reason := 'Cached result from previous attempt.'; next_available_at := null;
      offer_id := null; retailer_id := null; offer_title := null; benefit_text := null;
    end if;
    return next; return;
  end if;

  -- Step 1: Resolve caller's retailer
  select ru.retailer_id into v_caller_retailer_id
    from retailer_users ru
   where ru.profile_id = p_retailer_profile_id and ru.is_active = true
   limit 1;

  if v_caller_retailer_id is null then
    valid := false; status := 'rejected';
    rejection_reason := 'Caller is not an active retailer user.';
    next_available_at := null; offer_id := null; retailer_id := null; offer_title := null; benefit_text := null;
    return next; return;
  end if;

  -- Step 2: Lock and fetch token
  select * into v_token from redemption_tokens where token_hash = p_token_hash for update;

  if not found then
    valid := false; status := 'rejected'; rejection_reason := 'Token not found.';
    next_available_at := null; offer_id := null; retailer_id := null; offer_title := null; benefit_text := null;
    return next; return;
  end if;

  -- Step 3: Correct retailer
  if v_token.retailer_id <> v_caller_retailer_id then
    valid := false; status := 'rejected';
    rejection_reason := 'This QR code was not issued for your retailer.';
    next_available_at := null; offer_id := null; retailer_id := null; offer_title := null; benefit_text := null;
    return next; return;
  end if;

  -- Step 4: Token not expired
  if v_token.expires_at < now() then
    valid := false; status := 'expired';
    rejection_reason := 'QR code has expired. Ask the member to refresh.';
    next_available_at := null; offer_id := null; retailer_id := null; offer_title := null; benefit_text := null;
    return next; return;
  end if;

  -- Step 5: Not already consumed
  if v_token.consumed_at is not null then
    valid := false; status := 'rejected';
    rejection_reason := 'This QR code has already been used.';
    next_available_at := null; offer_id := null; retailer_id := null; offer_title := null; benefit_text := null;
    return next; return;
  end if;

  -- ── Step 6: Membership check — DORMANT (free consumer tier) ──────────────
  -- All authenticated consumers are treated as active members.
  -- Restore the consumer_memberships query when paid tiers are introduced:
  --
  -- select exists(
  --   select 1 from consumer_memberships cm
  --    where cm.profile_id = v_token.profile_id
  --      and cm.status in ('active', 'trialing')
  --      and cm.current_period_end > now()
  -- ) into v_membership_ok;
  --
  -- if not v_membership_ok then
  --   insert into redemptions(profile_id, retailer_id, retailer_location_id,
  --     offer_id, redemption_token_id, status, rejection_reason,
  --     validated_by_profile_id)
  --   values (v_token.profile_id, v_token.retailer_id, v_token.retailer_location_id,
  --     v_token.offer_id, v_token.id, 'membership_invalid',
  --     'Consumer membership is not active.', p_retailer_profile_id);
  --   insert into redemption_attempts(attempt_id, redemption_token_id, result_status)
  --   values (p_redemption_attempt_id, v_token.id, 'membership_invalid');
  --   valid := false; status := 'membership_invalid';
  --   rejection_reason := 'This member does not have an active membership.';
  --   next_available_at := null; offer_id := null; retailer_id := null;
  --   offer_title := null; benefit_text := null;
  --   return next; return;
  -- end if;
  v_membership_ok := true;

  -- Step 7: Offer still live and belongs to this retailer
  select * into v_offer from offers o where o.id = v_token.offer_id;

  if not found
     or v_offer.status <> 'live'
     or v_offer.retailer_id <> v_token.retailer_id
     or (v_offer.start_at is not null and v_offer.start_at > now())
     or (v_offer.end_at   is not null and v_offer.end_at   < now())
  then
    insert into redemptions(profile_id, retailer_id, retailer_location_id, offer_id,
      redemption_token_id, status, rejection_reason, validated_by_profile_id)
    values (v_token.profile_id, v_token.retailer_id, v_token.retailer_location_id,
      v_token.offer_id, v_token.id, 'rejected', 'Offer is no longer available.', p_retailer_profile_id);
    insert into redemption_attempts(attempt_id, redemption_token_id, result_status)
    values (p_redemption_attempt_id, v_token.id, 'rejected');
    valid := false; status := 'rejected'; rejection_reason := 'This offer is no longer available.';
    next_available_at := null; offer_id := null; retailer_id := null; offer_title := null; benefit_text := null;
    return next; return;
  end if;

  -- Step 8: Offer rules
  select * into v_rules from offer_rules r where r.offer_id = v_token.offer_id;

  if found then
    if v_rules.max_redemptions_per_user is not null then
      select count(*) into v_count from redemptions r
       where r.offer_id = v_token.offer_id and r.profile_id = v_token.profile_id and r.status = 'success';
      if v_count >= v_rules.max_redemptions_per_user then
        insert into redemptions(profile_id, retailer_id, retailer_location_id, offer_id,
          redemption_token_id, status, rejection_reason, validated_by_profile_id)
        values (v_token.profile_id, v_token.retailer_id, v_token.retailer_location_id,
          v_token.offer_id, v_token.id, 'rule_blocked', 'Per-user redemption limit reached.', p_retailer_profile_id);
        insert into redemption_attempts(attempt_id, redemption_token_id, result_status)
        values (p_redemption_attempt_id, v_token.id, 'rule_blocked');
        valid := false; status := 'rule_blocked';
        rejection_reason := 'This member has already used this offer the maximum number of times.';
        next_available_at := null; offer_id := null; retailer_id := null; offer_title := null; benefit_text := null;
        return next; return;
      end if;
    end if;

    if v_rules.max_redemptions_per_day is not null then
      v_today_start    := date_trunc('day', now() at time zone 'UTC') at time zone 'UTC';
      v_tomorrow_start := v_today_start + interval '1 day';
      select count(*) into v_count from redemptions r
       where r.offer_id = v_token.offer_id and r.profile_id = v_token.profile_id
         and r.status = 'success' and r.redeemed_at >= v_today_start;
      if v_count >= v_rules.max_redemptions_per_day then
        insert into redemptions(profile_id, retailer_id, retailer_location_id, offer_id,
          redemption_token_id, status, rejection_reason, validated_by_profile_id)
        values (v_token.profile_id, v_token.retailer_id, v_token.retailer_location_id,
          v_token.offer_id, v_token.id, 'rule_blocked', 'Daily redemption limit reached.', p_retailer_profile_id);
        insert into redemption_attempts(attempt_id, redemption_token_id, result_status)
        values (p_redemption_attempt_id, v_token.id, 'rule_blocked');
        valid := false; status := 'rule_blocked';
        rejection_reason := 'This member has already used this offer today.';
        next_available_at := v_tomorrow_start;
        offer_id := null; retailer_id := null; offer_title := null; benefit_text := null;
        return next; return;
      end if;
    end if;

    if v_rules.max_redemptions_total is not null then
      select count(*) into v_count from redemptions r
       where r.offer_id = v_token.offer_id and r.status = 'success';
      if v_count >= v_rules.max_redemptions_total then
        insert into redemptions(profile_id, retailer_id, retailer_location_id, offer_id,
          redemption_token_id, status, rejection_reason, validated_by_profile_id)
        values (v_token.profile_id, v_token.retailer_id, v_token.retailer_location_id,
          v_token.offer_id, v_token.id, 'rule_blocked', 'Offer total redemption cap reached.', p_retailer_profile_id);
        insert into redemption_attempts(attempt_id, redemption_token_id, result_status)
        values (p_redemption_attempt_id, v_token.id, 'rule_blocked');
        valid := false; status := 'rule_blocked';
        rejection_reason := 'This offer has reached its total redemption limit.';
        next_available_at := null; offer_id := null; retailer_id := null; offer_title := null; benefit_text := null;
        return next; return;
      end if;
    end if;

    if v_rules.cooldown_hours is not null then
      select r.redeemed_at into v_last_redeemed_at from redemptions r
       where r.offer_id = v_token.offer_id and r.profile_id = v_token.profile_id and r.status = 'success'
       order by r.redeemed_at desc limit 1;
      if found then
        v_cooldown_ends_at := v_last_redeemed_at + (v_rules.cooldown_hours * interval '1 hour');
        if v_cooldown_ends_at > now() then
          insert into redemptions(profile_id, retailer_id, retailer_location_id, offer_id,
            redemption_token_id, status, rejection_reason, validated_by_profile_id)
          values (v_token.profile_id, v_token.retailer_id, v_token.retailer_location_id,
            v_token.offer_id, v_token.id, 'rule_blocked', 'Cooldown period not yet elapsed.', p_retailer_profile_id);
          insert into redemption_attempts(attempt_id, redemption_token_id, result_status)
          values (p_redemption_attempt_id, v_token.id, 'rule_blocked');
          valid := false; status := 'rule_blocked';
          rejection_reason := 'This member must wait before using this offer again.';
          next_available_at := v_cooldown_ends_at;
          offer_id := null; retailer_id := null; offer_title := null; benefit_text := null;
          return next; return;
        end if;
      end if;
    end if;

    if v_rules.valid_days_json is not null then
      v_current_day := lower(to_char(now() at time zone 'UTC', 'Dy'));
      if not (v_rules.valid_days_json @> jsonb_build_array(v_current_day)) then
        insert into redemptions(profile_id, retailer_id, retailer_location_id, offer_id,
          redemption_token_id, status, rejection_reason, validated_by_profile_id)
        values (v_token.profile_id, v_token.retailer_id, v_token.retailer_location_id,
          v_token.offer_id, v_token.id, 'rule_blocked',
          'Offer not valid on ' || initcap(v_current_day) || 's.', p_retailer_profile_id);
        insert into redemption_attempts(attempt_id, redemption_token_id, result_status)
        values (p_redemption_attempt_id, v_token.id, 'rule_blocked');
        valid := false; status := 'rule_blocked';
        rejection_reason := 'This offer is not available on ' || initcap(v_current_day) || 's.';
        next_available_at := null; offer_id := null; retailer_id := null; offer_title := null; benefit_text := null;
        return next; return;
      end if;
    end if;

    if v_rules.valid_time_start is not null and v_rules.valid_time_end is not null then
      v_current_time := (now() at time zone 'UTC')::time;
      if v_current_time < v_rules.valid_time_start or v_current_time > v_rules.valid_time_end then
        insert into redemptions(profile_id, retailer_id, retailer_location_id, offer_id,
          redemption_token_id, status, rejection_reason, validated_by_profile_id)
        values (v_token.profile_id, v_token.retailer_id, v_token.retailer_location_id,
          v_token.offer_id, v_token.id, 'rule_blocked',
          'Offer only valid ' || v_rules.valid_time_start::text || '–' || v_rules.valid_time_end::text || ' UTC.',
          p_retailer_profile_id);
        insert into redemption_attempts(attempt_id, redemption_token_id, result_status)
        values (p_redemption_attempt_id, v_token.id, 'rule_blocked');
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
  end if;

  -- Step 9: Consume token
  update redemption_tokens set consumed_at = now() where id = v_token.id;

  -- Step 10: Record redemption
  insert into redemptions(profile_id, retailer_id, retailer_location_id, offer_id,
    redemption_token_id, status, validated_by_profile_id)
  values (v_token.profile_id, v_token.retailer_id, v_token.retailer_location_id,
    v_token.offer_id, v_token.id, 'success', p_retailer_profile_id)
  returning id into v_redemption_id;

  -- Step 11: Idempotency record
  insert into redemption_attempts(attempt_id, redemption_token_id, result_status)
  values (p_redemption_attempt_id, v_token.id, 'success');

  -- Step 12: Return success
  valid := true; status := 'success'; rejection_reason := null; next_available_at := null;
  offer_id := v_token.offer_id; retailer_id := v_token.retailer_id;
  offer_title := v_offer.title; benefit_text := v_offer.value_text;
  return next;
end;
$$;

revoke execute on function redeem_offer_token(text, uuid, uuid) from public;
revoke execute on function redeem_offer_token(text, uuid, uuid) from anon;
revoke execute on function redeem_offer_token(text, uuid, uuid) from authenticated;
grant  execute on function redeem_offer_token(text, uuid, uuid) to service_role;


-- ── process_loyalty_stamp — membership check dormant ─────────────────────────
-- Only Step 6 changes. All other logic identical to migration 084.

create or replace function process_loyalty_stamp(
  p_token_hash              text,
  p_retailer_profile_id     uuid,
  p_redemption_attempt_id   uuid
)
returns table(
  valid                   boolean,
  outcome                 text,
  status                  text,
  rejection_reason        text,
  stamps_earned           integer,
  stamps_required         integer,
  offer_title             text,
  reward_description      text,
  next_stamp_available_at timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_caller_retailer_id  uuid;
  v_token               redemption_tokens%rowtype;
  v_offer               offers%rowtype;
  v_loyalty_cfg         offer_loyalty_config%rowtype;
  v_membership_ok       boolean;
  v_card                loyalty_cards%rowtype;
  v_last_stamp_at       timestamptz;
  v_cooldown_ends_at    timestamptz;
  v_cached_status       text;
  v_redemption_id       uuid;
  v_new_stamps_earned   integer;
begin
  -- Step 0: Idempotency
  select ra.result_status into v_cached_status
    from redemption_attempts ra where ra.attempt_id = p_redemption_attempt_id;

  if found then
    if v_cached_status = 'success' then
      select lc.stamps_earned, lc.stamps_required, lc.status, o.title, olc.reward_description
        into v_new_stamps_earned, stamps_required, status, offer_title, reward_description
        from redemption_attempts ra
        join redemptions r on r.redemption_token_id = ra.redemption_token_id
        join offers o on o.id = r.offer_id
        join offer_loyalty_config olc on olc.offer_id = o.id
        left join loyalty_cards lc on lc.offer_id = o.id and lc.profile_id = r.profile_id
       where ra.attempt_id = p_redemption_attempt_id limit 1;

      if v_new_stamps_earned is null then
        valid := true; outcome := 'reward_claimed'; status := 'success'; rejection_reason := null;
        stamps_earned := null; stamps_required := null; next_stamp_available_at := null;
        return next; return;
      end if;

      stamps_earned := v_new_stamps_earned; valid := true;
      outcome := case when coalesce(status,'') = 'claimed' then 'reward_claimed'
                      when stamps_earned >= stamps_required then 'completed'
                      else 'stamped' end;
      rejection_reason := null; next_stamp_available_at := null;
      return next; return;
    else
      valid := false; outcome := v_cached_status; status := v_cached_status;
      rejection_reason := 'Cached result from previous attempt.';
      stamps_earned := null; stamps_required := null;
      offer_title := null; reward_description := null; next_stamp_available_at := null;
      return next; return;
    end if;
  end if;

  -- Step 1: Resolve caller's retailer
  select ru.retailer_id into v_caller_retailer_id
    from retailer_users ru where ru.profile_id = p_retailer_profile_id and ru.is_active = true limit 1;

  if v_caller_retailer_id is null then
    valid := false; outcome := 'rejected'; status := 'rejected';
    rejection_reason := 'Caller is not an active retailer user.';
    stamps_earned := null; stamps_required := null;
    offer_title := null; reward_description := null; next_stamp_available_at := null;
    return next; return;
  end if;

  -- Step 2: Lock and fetch token
  select * into v_token from redemption_tokens where token_hash = p_token_hash for update;

  if not found then
    valid := false; outcome := 'rejected'; status := 'rejected';
    rejection_reason := 'Token not found.';
    stamps_earned := null; stamps_required := null;
    offer_title := null; reward_description := null; next_stamp_available_at := null;
    return next; return;
  end if;

  -- Step 3: Correct retailer
  if v_token.retailer_id <> v_caller_retailer_id then
    valid := false; outcome := 'rejected'; status := 'rejected';
    rejection_reason := 'This QR code was not issued for your retailer.';
    stamps_earned := null; stamps_required := null;
    offer_title := null; reward_description := null; next_stamp_available_at := null;
    return next; return;
  end if;

  -- Step 4: Token not expired
  if v_token.expires_at < now() then
    valid := false; outcome := 'expired'; status := 'expired';
    rejection_reason := 'QR code has expired. Ask the member to refresh.';
    stamps_earned := null; stamps_required := null;
    offer_title := null; reward_description := null; next_stamp_available_at := null;
    return next; return;
  end if;

  -- Step 5: Token not consumed
  if v_token.consumed_at is not null then
    valid := false; outcome := 'rejected'; status := 'rejected';
    rejection_reason := 'This QR code has already been used.';
    stamps_earned := null; stamps_required := null;
    offer_title := null; reward_description := null; next_stamp_available_at := null;
    return next; return;
  end if;

  -- ── Step 6: Membership check — DORMANT (free consumer tier) ──────────────
  -- Restore the consumer_memberships query when paid tiers are introduced:
  --
  -- select exists(
  --   select 1 from consumer_memberships cm
  --    where cm.profile_id = v_token.profile_id
  --      and cm.status in ('active','trialing')
  --      and cm.current_period_end > now()
  -- ) into v_membership_ok;
  --
  -- if not v_membership_ok then
  --   insert into redemptions(...) values (..., 'membership_invalid', ...);
  --   insert into redemption_attempts(...) values (..., 'membership_invalid');
  --   valid := false; outcome := 'membership_invalid'; status := 'membership_invalid';
  --   rejection_reason := 'This member does not have an active membership.';
  --   stamps_earned := null; stamps_required := null;
  --   offer_title := null; reward_description := null; next_stamp_available_at := null;
  --   return next; return;
  -- end if;
  v_membership_ok := true;

  -- Step 7: Offer live, correct type, correct retailer, in date window
  select * into v_offer from offers o where o.id = v_token.offer_id;

  if not found
     or v_offer.offer_type <> 'loyalty_visits'
     or v_offer.status <> 'live'
     or v_offer.retailer_id <> v_token.retailer_id
     or (v_offer.start_at is not null and v_offer.start_at > now())
     or (v_offer.end_at   is not null and v_offer.end_at   < now())
  then
    insert into redemptions(profile_id, retailer_id, retailer_location_id, offer_id,
      redemption_token_id, status, rejection_reason, validated_by_profile_id)
    values (v_token.profile_id, v_token.retailer_id, v_token.retailer_location_id,
      v_token.offer_id, v_token.id, 'rejected', 'Offer is no longer available.', p_retailer_profile_id);
    insert into redemption_attempts(attempt_id, redemption_token_id, result_status)
    values (p_redemption_attempt_id, v_token.id, 'rejected');
    valid := false; outcome := 'rejected'; status := 'rejected';
    rejection_reason := 'This offer is no longer available.';
    stamps_earned := null; stamps_required := null;
    offer_title := null; reward_description := null; next_stamp_available_at := null;
    return next; return;
  end if;

  select * into v_loyalty_cfg from offer_loyalty_config where offer_id = v_token.offer_id;

  if not found then
    valid := false; outcome := 'rejected'; status := 'rejected';
    rejection_reason := 'Loyalty configuration not found for this offer.';
    stamps_earned := null; stamps_required := null;
    offer_title := null; reward_description := null; next_stamp_available_at := null;
    return next; return;
  end if;

  -- Step 8: Load or create loyalty card
  select * into v_card from loyalty_cards
   where profile_id = v_token.profile_id and offer_id = v_token.offer_id for update;

  if not found then
    insert into loyalty_cards(profile_id, offer_id, retailer_id, stamps_earned, stamps_required, status)
    values (v_token.profile_id, v_token.offer_id, v_token.retailer_id, 0, v_loyalty_cfg.stamps_required, 'active')
    on conflict (profile_id, offer_id) do nothing;

    select * into v_card from loyalty_cards
     where profile_id = v_token.profile_id and offer_id = v_token.offer_id for update;
  end if;

  -- Step 9: Card state guards
  if v_card.status = 'active' or v_card.status = 'completed' then
    if v_offer.end_at is not null and v_offer.end_at < now() then
      update loyalty_cards set status = 'expired', updated_at = now() where id = v_card.id;
      v_card.status := 'expired';
    end if;
  end if;

  if v_card.status = 'expired' then
    valid := false; outcome := 'expired'; status := 'expired';
    rejection_reason := 'This loyalty card has expired.';
    stamps_earned := v_card.stamps_earned; stamps_required := v_card.stamps_required;
    offer_title := v_offer.title; reward_description := v_loyalty_cfg.reward_description;
    next_stamp_available_at := null;
    return next; return;
  end if;

  if v_card.status = 'claimed' then
    valid := true; outcome := 'already_claimed'; status := 'success'; rejection_reason := null;
    stamps_earned := v_card.stamps_earned; stamps_required := v_card.stamps_required;
    offer_title := v_offer.title; reward_description := v_loyalty_cfg.reward_description;
    next_stamp_available_at := null;
    return next; return;
  end if;

  -- Step 10: If card completed, claim the reward
  if v_card.status = 'completed' then
    update redemption_tokens set consumed_at = now() where id = v_token.id;
    insert into redemptions(profile_id, retailer_id, retailer_location_id, offer_id,
      redemption_token_id, status, validated_by_profile_id)
    values (v_token.profile_id, v_token.retailer_id, v_token.retailer_location_id,
      v_token.offer_id, v_token.id, 'success', p_retailer_profile_id)
    returning id into v_redemption_id;
    update loyalty_cards set status = 'claimed', claimed_at = now(),
      reward_redemption_id = v_redemption_id, updated_at = now() where id = v_card.id;
    insert into redemption_attempts(attempt_id, redemption_token_id, result_status)
    values (p_redemption_attempt_id, v_token.id, 'success');
    valid := true; outcome := 'reward_claimed'; status := 'success'; rejection_reason := null;
    stamps_earned := v_card.stamps_earned; stamps_required := v_card.stamps_required;
    offer_title := v_offer.title; reward_description := v_loyalty_cfg.reward_description;
    next_stamp_available_at := null;
    return next; return;
  end if;

  -- Step 11: Cooldown check
  if v_loyalty_cfg.min_hours_between_stamps > 0 then
    select ls.stamped_at into v_last_stamp_at from loyalty_stamps ls
     where ls.loyalty_card_id = v_card.id order by ls.stamped_at desc limit 1;
    if found then
      v_cooldown_ends_at := v_last_stamp_at + (v_loyalty_cfg.min_hours_between_stamps * interval '1 hour');
      if v_cooldown_ends_at > now() then
        insert into redemption_attempts(attempt_id, redemption_token_id, result_status)
        values (p_redemption_attempt_id, v_token.id, 'rule_blocked');
        valid := false; outcome := 'rule_blocked'; status := 'rule_blocked';
        rejection_reason := 'Stamp already collected. Come back later for your next stamp.';
        stamps_earned := v_card.stamps_earned; stamps_required := v_card.stamps_required;
        offer_title := v_offer.title; reward_description := v_loyalty_cfg.reward_description;
        next_stamp_available_at := v_cooldown_ends_at;
        return next; return;
      end if;
    end if;
  end if;

  -- Step 12: Add stamp
  update redemption_tokens set consumed_at = now() where id = v_token.id;
  insert into redemptions(profile_id, retailer_id, retailer_location_id, offer_id,
    redemption_token_id, status, validated_by_profile_id)
  values (v_token.profile_id, v_token.retailer_id, v_token.retailer_location_id,
    v_token.offer_id, v_token.id, 'success', p_retailer_profile_id)
  returning id into v_redemption_id;
  insert into loyalty_stamps(loyalty_card_id, redemption_id, stamped_by_profile_id,
    retailer_location_id, stamped_at)
  values (v_card.id, v_redemption_id, p_retailer_profile_id, v_token.retailer_location_id, now());

  v_new_stamps_earned := v_card.stamps_earned + 1;

  -- Step 13: Complete card if target reached
  if v_new_stamps_earned >= v_loyalty_cfg.stamps_required then
    update loyalty_cards set stamps_earned = v_new_stamps_earned, status = 'completed',
      completed_at = now(), updated_at = now() where id = v_card.id;
    outcome := 'completed';
  else
    update loyalty_cards set stamps_earned = v_new_stamps_earned, updated_at = now()
     where id = v_card.id;
    outcome := 'stamped';
  end if;

  -- Step 14: Idempotency record
  insert into redemption_attempts(attempt_id, redemption_token_id, result_status)
  values (p_redemption_attempt_id, v_token.id, 'success');

  -- Step 15: Return
  valid := true; status := 'success'; rejection_reason := null;
  stamps_earned := v_new_stamps_earned; stamps_required := v_loyalty_cfg.stamps_required;
  offer_title := v_offer.title; reward_description := v_loyalty_cfg.reward_description;
  next_stamp_available_at := null;
  return next;
end;
$$;

revoke execute on function process_loyalty_stamp(text, uuid, uuid) from public;
revoke execute on function process_loyalty_stamp(text, uuid, uuid) from anon;
revoke execute on function process_loyalty_stamp(text, uuid, uuid) from authenticated;
grant  execute on function process_loyalty_stamp(text, uuid, uuid) to service_role;


-- ── redeem_offer_via_pass — membership check dormant ─────────────────────────
-- Only Step 3 changes. All other logic identical to migration 058.

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
begin
  -- Step 0: Idempotency
  select ra.result_status into v_cached_status
    from redemption_attempts ra where ra.attempt_id = p_redemption_attempt_id;

  if found then
    if v_cached_status = 'success' then
      select r.offer_id, r.retailer_id, o.title, o.value_text
        into offer_id, retailer_id, offer_title, benefit_text
        from redemption_attempts ra
        join redemptions r on r.id = ra.redemption_id
        join offers o on o.id = r.offer_id
       where ra.attempt_id = p_redemption_attempt_id limit 1;
      valid := true; status := 'success'; rejection_reason := null; next_available_at := null;
    else
      valid := false; status := v_cached_status;
      rejection_reason := 'Cached result from previous attempt.';
      next_available_at := null; offer_id := null; retailer_id := null; offer_title := null; benefit_text := null;
    end if;
    return next; return;
  end if;

  -- Step 1: Resolve caller's retailer
  select ru.retailer_id into v_caller_retailer_id
    from retailer_users ru where ru.profile_id = p_retailer_profile_id and ru.is_active = true limit 1;

  if v_caller_retailer_id is null then
    valid := false; status := 'rejected';
    rejection_reason := 'Caller is not an active retailer user.';
    next_available_at := null; offer_id := null; retailer_id := null; offer_title := null; benefit_text := null;
    return next; return;
  end if;

  -- Step 2: Validate pass token
  select * into v_pass_token from membership_pass_tokens where token_hash = p_pass_token_hash;

  if not found then
    valid := false; status := 'rejected'; rejection_reason := 'Pass token not found.';
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

  -- ── Step 3: Membership check — DORMANT (free consumer tier) ──────────────
  -- Restore the consumer_memberships query when paid tiers are introduced:
  --
  -- select exists(
  --   select 1 from consumer_memberships cm
  --    where cm.profile_id = v_consumer_id
  --      and cm.status in ('active', 'trialing')
  --      and cm.current_period_end > now()
  -- ) into v_membership_ok;
  --
  -- if not v_membership_ok then
  --   insert into redemption_attempts(attempt_id, redemption_token_id, redemption_id, result_status)
  --   values (p_redemption_attempt_id, null, null, 'membership_invalid');
  --   valid := false; status := 'membership_invalid';
  --   rejection_reason := 'This member does not have an active membership.';
  --   next_available_at := null; offer_id := null; retailer_id := null;
  --   offer_title := null; benefit_text := null;
  --   return next; return;
  -- end if;
  v_membership_ok := true;

  -- Step 4: Offer live, in window, belongs to caller's retailer
  select * into v_offer from offers o where o.id = p_offer_id;

  if not found
     or v_offer.status <> 'live'
     or v_offer.retailer_id <> v_caller_retailer_id
     or (v_offer.start_at is not null and v_offer.start_at > now())
     or (v_offer.end_at   is not null and v_offer.end_at   < now())
  then
    insert into redemption_attempts(attempt_id, redemption_token_id, redemption_id, result_status)
    values (p_redemption_attempt_id, null, null, 'rejected');
    valid := false; status := 'rejected'; rejection_reason := 'Offer is no longer available.';
    next_available_at := null; offer_id := null; retailer_id := null; offer_title := null; benefit_text := null;
    return next; return;
  end if;

  -- Step 5: Offer rules
  select * into v_rules from offer_rules r where r.offer_id = p_offer_id;

  if found then
    v_today_start    := date_trunc('day', now() at time zone 'UTC') at time zone 'UTC';
    v_tomorrow_start := v_today_start + interval '1 day';

    if v_rules.max_redemptions_per_user is not null then
      select count(*) into v_count from redemptions r
       where r.offer_id = p_offer_id and r.profile_id = v_consumer_id and r.status = 'success';
      if v_count >= v_rules.max_redemptions_per_user then
        insert into redemption_attempts(attempt_id, redemption_token_id, redemption_id, result_status)
        values (p_redemption_attempt_id, null, null, 'rule_blocked');
        valid := false; status := 'rule_blocked';
        rejection_reason := 'This member has already used this offer the maximum number of times.';
        next_available_at := null; offer_id := null; retailer_id := null; offer_title := null; benefit_text := null;
        return next; return;
      end if;
    end if;

    if v_rules.max_redemptions_per_day is not null then
      select count(*) into v_count from redemptions r
       where r.offer_id = p_offer_id and r.profile_id = v_consumer_id
         and r.status = 'success' and r.redeemed_at >= v_today_start;
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

    if v_rules.max_redemptions_total is not null then
      select count(*) into v_count from redemptions r
       where r.offer_id = p_offer_id and r.status = 'success';
      if v_count >= v_rules.max_redemptions_total then
        insert into redemption_attempts(attempt_id, redemption_token_id, redemption_id, result_status)
        values (p_redemption_attempt_id, null, null, 'rule_blocked');
        valid := false; status := 'rule_blocked';
        rejection_reason := 'This offer has reached its total redemption limit.';
        next_available_at := null; offer_id := null; retailer_id := null; offer_title := null; benefit_text := null;
        return next; return;
      end if;
    end if;

    if v_rules.cooldown_hours is not null then
      select r.redeemed_at into v_last_redeemed_at from redemptions r
       where r.offer_id = p_offer_id and r.profile_id = v_consumer_id and r.status = 'success'
       order by r.redeemed_at desc limit 1;
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

    if v_rules.new_customers_only then
      select count(*) into v_count from redemptions r
       where r.retailer_id = v_caller_retailer_id and r.profile_id = v_consumer_id and r.status = 'success';
      if v_count > 0 then
        insert into redemption_attempts(attempt_id, redemption_token_id, redemption_id, result_status)
        values (p_redemption_attempt_id, null, null, 'rule_blocked');
        valid := false; status := 'rule_blocked';
        rejection_reason := 'This offer is only available to members who have not previously redeemed at this retailer.';
        next_available_at := null; offer_id := null; retailer_id := null; offer_title := null; benefit_text := null;
        return next; return;
      end if;
    end if;
  end if;

  -- Step 6: Insert redemption
  insert into redemptions(profile_id, retailer_id, retailer_location_id, offer_id,
    redemption_token_id, status, validated_by_profile_id)
  values (v_consumer_id, v_caller_retailer_id, p_retailer_location_id, p_offer_id,
    null, 'success', p_retailer_profile_id)
  returning id into v_redemption_id;

  -- Step 7: Idempotency record
  insert into redemption_attempts(attempt_id, redemption_token_id, redemption_id, result_status)
  values (p_redemption_attempt_id, null, v_redemption_id, 'success');

  -- Step 8: Return success
  valid := true; status := 'success'; rejection_reason := null; next_available_at := null;
  offer_id := p_offer_id; retailer_id := v_caller_retailer_id;
  offer_title := v_offer.title; benefit_text := v_offer.value_text;
  return next;
end;
$$;

revoke execute on function redeem_offer_via_pass(text, uuid, uuid, uuid, uuid) from public;
revoke execute on function redeem_offer_via_pass(text, uuid, uuid, uuid, uuid) from anon;
revoke execute on function redeem_offer_via_pass(text, uuid, uuid, uuid, uuid) from authenticated;
grant  execute on function redeem_offer_via_pass(text, uuid, uuid, uuid, uuid) to service_role;
