-- 045_analytics_indexes.sql
-- Indexes supporting the availability RPCs and future analytics queries.
-- All indexes are partial or covering to keep write overhead minimal.

-- Analytics date-range queries (retailer analytics page: claimed today/month,
-- recent scans feed, per-retailer redemption counts).
create index if not exists redemptions_retailer_redeemed_at_idx
  on redemptions (retailer_id, redeemed_at desc);

-- Per-user cap checks inside get_retailer_offers_availability and
-- get_offer_availability RPCs (lifetime cap, daily cap, cooldown lookups).
-- Uses profile_id (the consumer column name on redemptions).
create index if not exists redemptions_offer_profile_redeemed_at_idx
  on redemptions (offer_id, profile_id, redeemed_at desc);

-- Retailer daily cap check inside availability RPC
-- (max_offers_per_retailer_per_day cross-offer count per consumer per day).
create index if not exists redemptions_retailer_profile_redeemed_at_idx
  on redemptions (retailer_id, profile_id, redeemed_at desc);

-- Visit grouping queries (future: visit analytics, max_offers_per_visit).
-- Partial index — excludes the large null population until feature ships.
create index if not exists redemptions_visit_id_idx
  on redemptions (visit_id)
  where visit_id is not null;

-- Scanner session queries (future: scanner session analytics).
create index if not exists redemptions_scanner_session_id_idx
  on redemptions (scanner_session_id)
  where scanner_session_id is not null;
