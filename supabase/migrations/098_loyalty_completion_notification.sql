-- 098_loyalty_completion_notification.sql
-- Enhance process_loyalty_stamp to send an in-app notification when a
-- consumer's loyalty card transitions to 'completed'.
--
-- The notification is inserted via insert_notification() which is accessible
-- to service_role (the only caller of process_loyalty_stamp).
--
-- Notification payload:
--   type  : 'loyalty'
--   title : 'Card complete! 🎉'
--   body  : 'Your loyalty card for [offer title] is ready to claim.'
--   data  : { "offer_id": "<offer_id>", "card_id": "<card_id>" }
--
-- This is a full replacement of process_loyalty_stamp (CREATE OR REPLACE).
-- The function body is identical to migration 084 except for the added
-- insert_notification() call in Step 13.

create or replace function process_loyalty_stamp(
  p_token_hash              text,
  p_retailer_profile_id     uuid,
  p_redemption_attempt_id   uuid
)
returns table(
  valid                   boolean,
  outcome                 text,       -- 'stamped'|'completed'|'reward_claimed'|rejection status
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
  -- ── Step 0: Idempotency ───────────────────────────────────────────────────
  select ra.result_status
    into v_cached_status
    from redemption_attempts ra
   where ra.attempt_id = p_redemption_attempt_id;

  if found then
    if v_cached_status = 'success' then
      -- Re-fetch the current card state to return meaningful progress.
      select lc.stamps_earned, lc.stamps_required, lc.status,
             o.title, olc.reward_description
        into v_new_stamps_earned, stamps_required, status,
             offer_title, reward_description
        from redemption_attempts ra
        join redemptions r      on r.redemption_token_id = ra.redemption_token_id
        join offers o           on o.id = r.offer_id
        join offer_loyalty_config olc on olc.offer_id = o.id
        left join loyalty_cards lc on lc.offer_id = o.id and lc.profile_id = r.profile_id
       where ra.attempt_id = p_redemption_attempt_id
       limit 1;

      -- Card was deleted after the original success; no stamps_earned to return.
      if v_new_stamps_earned is null then
        valid                   := true;
        outcome                 := 'reward_claimed';
        status                  := 'success';
        rejection_reason        := null;
        stamps_earned           := null;
        stamps_required         := null;
        next_stamp_available_at := null;
        return next;
        return;
      end if;

      stamps_earned  := v_new_stamps_earned;
      valid          := true;
      outcome        := case when coalesce(status,'') = 'claimed' then 'reward_claimed'
                             when stamps_earned >= stamps_required then 'completed'
                             else 'stamped' end;
      rejection_reason        := null;
      next_stamp_available_at := null;
      return next;
      return;
    else
      valid                   := false;
      outcome                 := v_cached_status;
      status                  := v_cached_status;
      rejection_reason        := 'Cached result from previous attempt.';
      stamps_earned           := null;
      stamps_required         := null;
      offer_title             := null;
      reward_description      := null;
      next_stamp_available_at := null;
      return next;
      return;
    end if;
  end if;

  -- ── Step 1: Resolve caller's retailer ────────────────────────────────────
  select ru.retailer_id
    into v_caller_retailer_id
    from retailer_users ru
   where ru.profile_id = p_retailer_profile_id
     and ru.is_active = true
   limit 1;

  if v_caller_retailer_id is null then
    valid := false; outcome := 'rejected'; status := 'rejected';
    rejection_reason := 'Caller is not an active retailer user.';
    stamps_earned := null; stamps_required := null;
    offer_title := null; reward_description := null; next_stamp_available_at := null;
    return next; return;
  end if;

  -- ── Step 2: Lock and fetch token ─────────────────────────────────────────
  select * into v_token
    from redemption_tokens
   where token_hash = p_token_hash
   for update;

  if not found then
    valid := false; outcome := 'rejected'; status := 'rejected';
    rejection_reason := 'Token not found.';
    stamps_earned := null; stamps_required := null;
    offer_title := null; reward_description := null; next_stamp_available_at := null;
    return next; return;
  end if;

  -- ── Step 3: Correct retailer ──────────────────────────────────────────────
  if v_token.retailer_id <> v_caller_retailer_id then
    valid := false; outcome := 'rejected'; status := 'rejected';
    rejection_reason := 'This QR code was not issued for your retailer.';
    stamps_earned := null; stamps_required := null;
    offer_title := null; reward_description := null; next_stamp_available_at := null;
    return next; return;
  end if;

  -- ── Step 4: Token not expired ─────────────────────────────────────────────
  if v_token.expires_at < now() then
    valid := false; outcome := 'expired'; status := 'expired';
    rejection_reason := 'QR code has expired. Ask the member to refresh.';
    stamps_earned := null; stamps_required := null;
    offer_title := null; reward_description := null; next_stamp_available_at := null;
    return next; return;
  end if;

  -- ── Step 5: Token not consumed ────────────────────────────────────────────
  if v_token.consumed_at is not null then
    valid := false; outcome := 'rejected'; status := 'rejected';
    rejection_reason := 'This QR code has already been used.';
    stamps_earned := null; stamps_required := null;
    offer_title := null; reward_description := null; next_stamp_available_at := null;
    return next; return;
  end if;

  -- ── Step 6: Consumer membership active ───────────────────────────────────
  select exists(
    select 1 from consumer_memberships cm
     where cm.profile_id = v_token.profile_id
       and cm.status in ('active','trialing')
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

    valid := false; outcome := 'membership_invalid'; status := 'membership_invalid';
    rejection_reason := 'This member does not have an active membership.';
    stamps_earned := null; stamps_required := null;
    offer_title := null; reward_description := null; next_stamp_available_at := null;
    return next; return;
  end if;

  -- ── Step 7: Offer live, correct type, correct retailer, in date window ───
  select * into v_offer from offers o where o.id = v_token.offer_id;

  if not found
     or v_offer.offer_type <> 'loyalty_visits'
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

    valid := false; outcome := 'rejected'; status := 'rejected';
    rejection_reason := 'This offer is no longer available.';
    stamps_earned := null; stamps_required := null;
    offer_title := null; reward_description := null; next_stamp_available_at := null;
    return next; return;
  end if;

  -- Load loyalty config.
  select * into v_loyalty_cfg from offer_loyalty_config where offer_id = v_token.offer_id;

  if not found then
    valid := false; outcome := 'rejected'; status := 'rejected';
    rejection_reason := 'Loyalty configuration not found for this offer.';
    stamps_earned := null; stamps_required := null;
    offer_title := null; reward_description := null; next_stamp_available_at := null;
    return next; return;
  end if;

  -- ── Step 8: Load or create loyalty card (FOR UPDATE) ─────────────────────
  -- Try to fetch the existing card with a row lock.
  select * into v_card
    from loyalty_cards
   where profile_id = v_token.profile_id
     and offer_id   = v_token.offer_id
   for update;

  if not found then
    -- First scan for this member on this offer.  Create the card.
    -- ON CONFLICT handles the rare case of two simultaneous first scans.
    insert into loyalty_cards(
      profile_id, offer_id, retailer_id,
      stamps_earned, stamps_required, status
    )
    values (
      v_token.profile_id, v_token.offer_id, v_token.retailer_id,
      0, v_loyalty_cfg.stamps_required, 'active'
    )
    on conflict (profile_id, offer_id) do nothing;

    -- Re-fetch with lock (the insert winner and any concurrent loser both end here).
    select * into v_card
      from loyalty_cards
     where profile_id = v_token.profile_id
       and offer_id   = v_token.offer_id
     for update;
  end if;

  -- ── Step 9: Card state guards ─────────────────────────────────────────────
  -- Expire card if offer has ended and card was never claimed.
  if v_card.status = 'active' or v_card.status = 'completed' then
    if v_offer.end_at is not null and v_offer.end_at < now() then
      update loyalty_cards set status = 'expired', updated_at = now()
       where id = v_card.id;
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
    valid := true; outcome := 'already_claimed'; status := 'success';
    rejection_reason := null;
    stamps_earned := v_card.stamps_earned; stamps_required := v_card.stamps_required;
    offer_title := v_offer.title; reward_description := v_loyalty_cfg.reward_description;
    next_stamp_available_at := null;
    return next; return;
  end if;

  -- ── Step 10: If card completed, claim the reward on this scan ────────────
  -- Member has already completed the card and is presenting their QR to collect.
  if v_card.status = 'completed' then
    -- Consume token.
    update redemption_tokens set consumed_at = now() where id = v_token.id;

    -- Record redemption for the reward claim.
    insert into redemptions(
      profile_id, retailer_id, retailer_location_id, offer_id,
      redemption_token_id, status, validated_by_profile_id
    ) values (
      v_token.profile_id, v_token.retailer_id, v_token.retailer_location_id,
      v_token.offer_id, v_token.id,
      'success', p_retailer_profile_id
    ) returning id into v_redemption_id;

    -- Mark card claimed.
    update loyalty_cards
       set status = 'claimed',
           claimed_at = now(),
           reward_redemption_id = v_redemption_id,
           updated_at = now()
     where id = v_card.id;

    -- Idempotency record.
    insert into redemption_attempts(attempt_id, redemption_token_id, result_status)
    values (p_redemption_attempt_id, v_token.id, 'success');

    valid := true; outcome := 'reward_claimed'; status := 'success';
    rejection_reason := null;
    stamps_earned := v_card.stamps_earned; stamps_required := v_card.stamps_required;
    offer_title := v_offer.title; reward_description := v_loyalty_cfg.reward_description;
    next_stamp_available_at := null;
    return next; return;
  end if;

  -- ── Step 11: Cooldown check ───────────────────────────────────────────────
  if v_loyalty_cfg.min_hours_between_stamps > 0 then
    select ls.stamped_at into v_last_stamp_at
      from loyalty_stamps ls
     where ls.loyalty_card_id = v_card.id
     order by ls.stamped_at desc
     limit 1;

    if found then
      v_cooldown_ends_at := v_last_stamp_at +
        (v_loyalty_cfg.min_hours_between_stamps * interval '1 hour');

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

  -- ── Step 12: Add stamp ────────────────────────────────────────────────────
  -- Consume token first (inside same transaction — rolls back if anything below fails).
  update redemption_tokens set consumed_at = now() where id = v_token.id;

  -- Record the scanner validation redemption row.
  insert into redemptions(
    profile_id, retailer_id, retailer_location_id, offer_id,
    redemption_token_id, status, validated_by_profile_id
  ) values (
    v_token.profile_id, v_token.retailer_id, v_token.retailer_location_id,
    v_token.offer_id, v_token.id,
    'success', p_retailer_profile_id
  ) returning id into v_redemption_id;

  -- Insert stamp audit row.
  insert into loyalty_stamps(
    loyalty_card_id, redemption_id,
    stamped_by_profile_id, retailer_location_id, stamped_at
  ) values (
    v_card.id, v_redemption_id,
    p_retailer_profile_id, v_token.retailer_location_id, now()
  );

  v_new_stamps_earned := v_card.stamps_earned + 1;

  -- ── Step 13: Complete the card if target reached ──────────────────────────
  if v_new_stamps_earned >= v_loyalty_cfg.stamps_required then
    update loyalty_cards
       set stamps_earned = v_new_stamps_earned,
           status = 'completed',
           completed_at = now(),
           updated_at = now()
     where id = v_card.id;

    outcome := 'completed';

    -- ── Notify consumer: loyalty card completed ───────────────────────────
    -- Non-critical: any error here must not roll back the stamp transaction.
    begin
      perform insert_notification(
        v_token.profile_id,
        'loyalty',
        'Card complete! 🎉',
        'Your loyalty card for ' || v_offer.title || ' is ready to claim.',
        jsonb_build_object(
          'offer_id', v_token.offer_id::text,
          'card_id',  v_card.id::text
        )
      );
    exception when others then
      -- Swallow the error; logging is not available inside PL/pgSQL but the
      -- stamp itself has already been persisted at this point.
      null;
    end;
  else
    update loyalty_cards
       set stamps_earned = v_new_stamps_earned,
           updated_at = now()
     where id = v_card.id;

    outcome := 'stamped';
  end if;

  -- ── Step 14: Idempotency record ───────────────────────────────────────────
  insert into redemption_attempts(attempt_id, redemption_token_id, result_status)
  values (p_redemption_attempt_id, v_token.id, 'success');

  -- ── Step 15: Return ───────────────────────────────────────────────────────
  valid := true; status := 'success';
  rejection_reason := null;
  stamps_earned := v_new_stamps_earned;
  stamps_required := v_loyalty_cfg.stamps_required;
  offer_title := v_offer.title;
  reward_description := v_loyalty_cfg.reward_description;
  next_stamp_available_at := null;
  return next;
end;
$$;

-- Grants are unchanged from migration 084: service_role only.
revoke execute on function process_loyalty_stamp(text, uuid, uuid) from public;
revoke execute on function process_loyalty_stamp(text, uuid, uuid) from anon;
revoke execute on function process_loyalty_stamp(text, uuid, uuid) from authenticated;
grant  execute on function process_loyalty_stamp(text, uuid, uuid) to service_role;
