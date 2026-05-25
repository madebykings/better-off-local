-- 039_service_role_grants.sql
-- Restore standard Supabase service_role privileges on all public tables.
--
-- Background:
--   Supabase edge functions use a service-role Supabase client to perform
--   trusted server-side DB operations (membership checks, token creation,
--   Stripe webhook processing, etc.). The service_role JWT bypasses Row
--   Level Security entirely — but it still requires PostgreSQL-level GRANT
--   privileges to execute queries.
--
--   In a standard Supabase project these grants are set up at project
--   creation. This project's tables were created via migrations without
--   those default privileges in place, so service_role had no access.
--
-- Security model:
--   - service_role is used ONLY by trusted server-side code (edge functions,
--     server actions). It is never exposed to the client or app.
--   - anon and authenticated access is unchanged — RLS continues to restrict
--     their row-level access exactly as defined in migration 018 and 038.
--   - Granting service_role access to admin-only tables (admin_actions,
--     audit_events) is intentional: the stripe-webhook and other edge
--     functions write audit log entries via service_role.
--
-- Idempotency:
--   GRANT statements are idempotent in PostgreSQL — re-running has no effect
--   if the privilege already exists. ALTER DEFAULT PRIVILEGES is also safe
--   to re-run.

-- ── 1. Grant full access on all existing public tables ────────────────────────
-- Covers every table created up to and including this migration.

grant all on all tables in schema public to service_role;

-- ── 2. Grant full access on all existing sequences ────────────────────────────
-- No custom sequences exist currently (all PKs use gen_random_uuid()), but
-- this covers any sequences created by serial/bigserial columns in future
-- migrations and is included for completeness.

grant all on all sequences in schema public to service_role;

-- ── 3. Set default privileges for future tables and sequences ─────────────────
-- Ensures that tables and sequences created in subsequent migrations
-- automatically inherit service_role access without needing explicit grants.

alter default privileges in schema public
  grant all on tables to service_role;

alter default privileges in schema public
  grant all on sequences to service_role;
