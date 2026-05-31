-- 064_referral_grants.sql
-- Adds authenticated SELECT grants for the three referral tables.
--
-- RLS and row-scoped SELECT policies were added in 060 but no GRANT statements
-- were included. Without a table-level grant, PostgREST returns "permission denied"
-- even when the RLS policy would pass.
--
-- Note: the referral_stats view (also granted in 060) executes using the view
-- owner's table privileges, so the view itself is unaffected by this gap.
-- These grants are required for any direct table queries from the mobile app
-- (e.g. displaying the raw referral code, reading reward status).
--
-- INSERT/UPDATE/DELETE are intentionally excluded.
-- Writes go through generate_referral_code() and apply_referral_code() RPCs.

grant select on referral_codes        to authenticated;
grant select on referral_invitations  to authenticated;
grant select on referral_rewards      to authenticated;
