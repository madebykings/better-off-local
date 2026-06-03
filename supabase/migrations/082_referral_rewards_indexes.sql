-- 082_referral_rewards_indexes.sql
-- Partial indexes on referral_rewards that filter on enum values added in 080.
--
-- These cannot live in migration 080 because ALTER TYPE ADD VALUE and any
-- reference to the new enum value must be in separate transactions.
-- PostgreSQL raises "unsafe use of new value of enum type" if you reference a
-- freshly-added enum value later in the same transaction.

create index if not exists referral_rewards_eligible_status_idx
  on referral_rewards(referrer_profile_id, eligible_at)
  where status = 'eligible';

create index if not exists referral_rewards_paid_idx
  on referral_rewards(paid_at desc)
  where status = 'paid';
