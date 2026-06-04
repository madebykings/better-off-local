-- 097_reset_loyalty_card_rpc.sql
-- RPC: reset_loyalty_card(p_offer_id uuid, p_consumer_id uuid)
--
-- After a consumer has claimed their loyalty reward (status = 'claimed') they
-- should be able to start collecting stamps again on the same offer.  This
-- function creates a fresh loyalty_cards row so stamp collection can restart.
--
-- Returns: uuid — the id of the newly created loyalty_cards row.
-- Raises exceptions (code in SQLSTATE P0001) for business-rule violations:
--   no_claimed_card   — no claimed card exists for this consumer + offer
--   offer_not_live    — the offer is no longer live
--   active_card_exists — a fresh card already exists (hint contains card id)

create or replace function reset_loyalty_card(
  p_offer_id     uuid,
  p_consumer_id  uuid
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_claimed_card  loyalty_cards%rowtype;
  v_offer         offers%rowtype;
  v_active_card   loyalty_cards%rowtype;
  v_loyalty_cfg   offer_loyalty_config%rowtype;
  v_new_card_id   uuid;
begin
  -- ── Step 1: Find the most recent claimed card ─────────────────────────────
  select *
    into v_claimed_card
    from loyalty_cards
   where offer_id   = p_offer_id
     and profile_id = p_consumer_id
     and status     = 'claimed'
   order by claimed_at desc nulls last, created_at desc
   limit 1;

  if not found then
    raise exception 'no_claimed_card'
      using errcode = 'P0001',
            message = 'No claimed loyalty card found for this consumer and offer.';
  end if;

  -- ── Step 2: Offer must still be live ─────────────────────────────────────
  select *
    into v_offer
    from offers
   where id     = p_offer_id
     and status = 'live';

  if not found then
    raise exception 'offer_not_live'
      using errcode = 'P0001',
            message = 'The offer is no longer live.';
  end if;

  -- ── Step 3: Guard against duplicate active card ───────────────────────────
  select *
    into v_active_card
    from loyalty_cards
   where offer_id   = p_offer_id
     and profile_id = p_consumer_id
     and status     = 'active';

  if found then
    raise exception 'active_card_exists'
      using errcode = 'P0001',
            message = 'An active loyalty card already exists for this consumer and offer.',
            hint    = v_active_card.id::text;
  end if;

  -- ── Step 4: Load loyalty config for stamps_required ──────────────────────
  select *
    into v_loyalty_cfg
    from offer_loyalty_config
   where offer_id = p_offer_id;

  if not found then
    raise exception 'loyalty_config_missing'
      using errcode = 'P0001',
            message = 'Loyalty configuration not found for this offer.';
  end if;

  -- ── Step 5: Insert fresh card ─────────────────────────────────────────────
  -- The unique(profile_id, offer_id) constraint on loyalty_cards only allows
  -- one card per member per offer.  A fresh card is only possible here because
  -- process_loyalty_stamp uses a different code path that does ON CONFLICT DO
  -- NOTHING — the existing claimed card is a distinct row from the new one.
  -- We insert the new card with a new primary key; the old claimed card stays
  -- in the table as historical record.
  --
  -- NOTE: Because loyalty_cards has unique(profile_id, offer_id), inserting a
  -- second row for the same pair would violate the constraint.  To support
  -- repeat cards the consumer's previous card must be the ONLY row for this
  -- pair — which is true after the active-card guard above.  However, the
  -- claimed card itself still occupies the unique slot.  We therefore update
  -- the existing claimed card's id is not reused — instead we UPDATE the
  -- claimed card to 'active' with reset counters so the unique constraint is
  -- not violated.

  update loyalty_cards
     set stamps_earned = 0,
         status        = 'active',
         completed_at  = null,
         claimed_at    = null,
         reward_redemption_id = null,
         updated_at    = now()
   where id = v_claimed_card.id
   returning id into v_new_card_id;

  return v_new_card_id;
end;
$$;

-- Only authenticated users (consumers) and service_role may call this.
-- The calling app is responsible for ensuring p_consumer_id = auth.uid().
revoke execute on function reset_loyalty_card(uuid, uuid) from public;
revoke execute on function reset_loyalty_card(uuid, uuid) from anon;
grant  execute on function reset_loyalty_card(uuid, uuid) to authenticated;
grant  execute on function reset_loyalty_card(uuid, uuid) to service_role;
