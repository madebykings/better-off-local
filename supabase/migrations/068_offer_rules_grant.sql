-- 068_offer_rules_grant.sql
-- Grants authenticated SELECT on offer_rules so PostgREST can execute the
-- embedded join used by the offer feed.
--
-- Root cause: migration 018 enabled RLS on offer_rules and added a policy
-- ("Anyone can read rules for accessible offers") but never issued a table-level
-- GRANT SELECT. Migration 038 covered most consumer-facing tables but missed
-- offer_rules. PostgREST requires both a GRANT and a passing RLS policy.
--
-- The _listSelect query in OffersRemoteDataSource joins offer_rules inline:
--   .select('..., offer_rules(max_redemptions_per_user, ...)')
-- Without the grant every authenticated offer list request fails with:
--   "permission denied for table public.offer_rules"
--
-- anon is included for consistency with the "Anyone" intent of the 018 policy,
-- and in case unauthenticated browsing is added later.

grant select on offer_rules to authenticated, anon;
