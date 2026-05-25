-- 047_profile_update_grant.sql
-- Grant column-level UPDATE on profiles so the Flutter consumer app can
-- complete the onboarding flow (CompleteProfileScreen) and update safe
-- profile fields.
--
-- Background: Migration 038 intentionally withheld the UPDATE grant on
-- profiles because the existing RLS UPDATE policy (migration 018) had no
-- WITH CHECK clause, meaning a malicious client could change any column —
-- including `role` and `is_active`. Column-level grants solve this: even
-- with the broad RLS USING clause, PostgREST will only allow the client to
-- touch the listed columns.
--
-- Safe columns: full_name, phone, avatar_url.
-- Excluded: id, role, is_active, created_at, stripe_customer_id — these
--   must only change via edge functions or admin actions.

grant update (full_name, phone, avatar_url) on profiles to authenticated;
