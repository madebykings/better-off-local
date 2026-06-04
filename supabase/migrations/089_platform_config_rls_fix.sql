-- 089_platform_config_rls_fix.sql
--
-- Root cause: platform_config returns 0 rows to the anon role despite:
--   • correct Supabase project (url_ref == jwt_ref in debug overlay)
--   • table existing (no PostgrestException on select)
--   • service_role (admin portal) seeing row id=1 correctly
--   • migration 070 granting SELECT to anon
--
-- Diagnostic queries to run in the Supabase SQL editor:
--
--   -- Confirm RLS state (relrowsecurity = true means RLS is ON)
--   SELECT relrowsecurity FROM pg_class WHERE relname = 'platform_config';
--
--   -- List any policies (empty = no permissive policy → all rows denied)
--   SELECT * FROM pg_policies WHERE tablename = 'platform_config';
--
--   -- Confirm the row exists via service_role
--   SELECT * FROM platform_config;
--
-- The 0-rows / no-error / service_role-succeeds pattern is the exact
-- signature of RLS enabled with no permissive policy (PostgreSQL
-- deny-by-default).  No migration file enables RLS on this table, so it
-- was toggled on via the Supabase dashboard.
--
-- Fix: platform_config is a single publicly-readable admin config row.
-- RLS provides zero security benefit.  Disable it.

alter table platform_config disable row level security;

-- Re-confirm the SELECT grant in case it was revoked alongside the RLS toggle.
grant select on platform_config to anon, authenticated;

-- Ensure the seed row is present (idempotent; safe on fresh environments
-- where the migration was applied but the INSERT somehow missed).
insert into platform_config (id) values (1) on conflict (id) do nothing;
