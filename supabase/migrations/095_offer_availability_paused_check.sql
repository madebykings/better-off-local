-- Migration 095: Fix get_offer_availability to return offer_unavailable for
-- paused / archived / rejected offers.
--
-- Previously get_offer_availability delegated directly to
-- get_retailer_offers_availability, which only iterates over
-- status IN ('live', 'expired'). A paused offer was simply absent from the
-- result set, leaving the mobile client with no availability state — which
-- could render the offer detail as though the offer were still available.
--
-- This migration recreates get_offer_availability as a plpgsql function that
-- explicitly checks the offer status before delegating, so the client always
-- receives a clear 'offer_unavailable' state for non-live/non-expired offers.

create or replace function get_offer_availability(
  p_offer_id    uuid,
  p_consumer_id uuid
)
returns table(
  availability_state text,
  available_at       timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_offer_status text;
begin
  select status into v_offer_status
    from offers
   where id = p_offer_id;

  -- Offer not found at all
  if not found then
    availability_state := 'offer_unavailable';
    available_at := null;
    return next;
    return;
  end if;

  -- Paused, archived, rejected, draft, pending — not redeemable
  if v_offer_status not in ('live', 'expired') then
    availability_state := 'offer_unavailable';
    available_at := null;
    return next;
    return;
  end if;

  -- Delegate to the bulk RPC for full availability checks
  return query
    select a.availability_state, a.available_at
      from get_retailer_offers_availability(
        (select retailer_id from offers where id = p_offer_id),
        p_consumer_id
      ) a
     where a.offer_id = p_offer_id;
end;
$$;

-- Grants unchanged from original migration 046
grant execute on function get_offer_availability(uuid, uuid) to authenticated;
revoke execute on function get_offer_availability(uuid, uuid) from anon;
