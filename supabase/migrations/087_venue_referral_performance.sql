-- 087_venue_referral_performance.sql
-- Performance hardening for the venue referral AFTER INSERT trigger.
--
-- 1. Adds WHEN (NEW.status = 'success') to the trigger definition so the
--    executor short-circuits before calling the trigger function on every
--    non-success insert (rejected, expired, membership_invalid, etc.).
--
-- 2. Adds a composite index covering the prior-customer check query inside
--    try_unlock_venue_referral_rewards:
--      SELECT COUNT(*) FROM redemptions
--       WHERE profile_id = ? AND retailer_id = ? AND status = 'success'
--         AND created_at < attributed_at
--    The existing redemptions_retailer_profile_redeemed_at_idx covers
--    (retailer_id, profile_id) but not status or created_at, leaving both
--    predicates as post-fetch filters.
--
-- 3. Replaces EXCEPTION WHEN OTHERS THEN NULL with a RAISE WARNING so silent
--    failures appear in Supabase logs. The isolation guarantee is unchanged —
--    WARNING-level messages never abort a transaction.

-- ── 1. Index ──────────────────────────────────────────────────────────────────

create index if not exists redemptions_profile_retailer_status_created_at_idx
  on redemptions (profile_id, retailer_id, status, created_at);

-- ── 2. Trigger function — add WARNING on error ────────────────────────────────

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
      raise warning 'venue referral trigger failed: %', sqlerrm;
    end;
  end if;
  return null;
end;
$$;

-- ── 3. Recreate trigger with WHEN clause ──────────────────────────────────────
-- DROP + CREATE is required; ALTER TRIGGER cannot modify the WHEN condition.

drop trigger if exists trigger_venue_referral_on_redemption on redemptions;

create trigger trigger_venue_referral_on_redemption
  after insert on redemptions
  for each row
  when (new.status = 'success')
  execute function _trigger_venue_referral_on_redemption();
