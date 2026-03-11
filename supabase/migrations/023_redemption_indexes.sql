-- 023_redemption_indexes.sql
-- Performance indexes for redemption token lookups and redemption history queries.

-- Fast token hash lookup during validation (already unique from table DDL,
-- but an explicit index guarantees the planner uses it).
create index if not exists idx_redemption_tokens_token_hash
  on redemption_tokens (token_hash);

-- Fast lookup of unconsumed tokens by profile (consumer QR screen polling).
create index if not exists idx_redemption_tokens_profile_unconsumed
  on redemption_tokens (profile_id, expires_at)
  where consumed_at is null;

-- Fast count of successful redemptions per offer per user (rule enforcement).
create index if not exists idx_redemptions_offer_profile_status
  on redemptions (offer_id, profile_id, status);

-- Fast count of total successful redemptions per offer (global cap rule).
create index if not exists idx_redemptions_offer_status
  on redemptions (offer_id, status);

-- Fast consumer history query.
create index if not exists idx_redemptions_profile_redeemed_at
  on redemptions (profile_id, redeemed_at desc);

-- Fast retailer redemption history query.
create index if not exists idx_redemptions_retailer_redeemed_at
  on redemptions (retailer_id, redeemed_at desc);
