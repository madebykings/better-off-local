-- 036_retailer_billing_activation.sql
-- Retailer billing activation: moves stripe_customer_id to retailers,
-- adds checkout session tracking, and indexes for webhook lookups.

-- ── Move stripe_customer_id from retailer_subscriptions → retailers ──────────

ALTER TABLE retailers ADD COLUMN IF NOT EXISTS stripe_customer_id text;

-- Back-fill from the most recent subscription row (if any exist already).
UPDATE retailers r
SET stripe_customer_id = rs.stripe_customer_id
FROM (
  SELECT DISTINCT ON (retailer_id)
    retailer_id, stripe_customer_id
  FROM retailer_subscriptions
  WHERE stripe_customer_id IS NOT NULL
  ORDER BY retailer_id, created_at DESC
) rs
WHERE rs.retailer_id = r.id
  AND r.stripe_customer_id IS NULL;

-- Drop the view that selects * from retailer_subscriptions (captures the column),
-- drop the column, then recreate the view.
DROP VIEW IF EXISTS active_retailer_subscriptions;
ALTER TABLE retailer_subscriptions DROP COLUMN IF EXISTS stripe_customer_id;
CREATE OR REPLACE VIEW active_retailer_subscriptions AS
  SELECT *
  FROM retailer_subscriptions
  WHERE status = 'active'
    AND current_period_end > now();

-- ── Additional tracking columns for retailer_subscriptions ───────────────────

-- Stripe Price ID used for this subscription (avoids hardcoding in webhook).
ALTER TABLE retailer_subscriptions ADD COLUMN IF NOT EXISTS stripe_price_id text;

-- Stripe Checkout Session ID — used for idempotent session reuse (<30 min window).
ALTER TABLE retailer_subscriptions ADD COLUMN IF NOT EXISTS stripe_checkout_session_id text;

-- ── Allow system-generated audit log entries (no human admin) ───────────────
-- Webhook events (subscription activated, cancelled) are automated — they have
-- no associated admin user. Making admin_profile_id nullable allows these entries
-- while human moderation actions continue to always supply a profile ID.
ALTER TABLE admin_actions ALTER COLUMN admin_profile_id DROP NOT NULL;

-- ── Indexes for webhook lookups ───────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_retailer_subscriptions_stripe_sub_id
  ON retailer_subscriptions(stripe_subscription_id)
  WHERE stripe_subscription_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_retailers_stripe_customer_id
  ON retailers(stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;
