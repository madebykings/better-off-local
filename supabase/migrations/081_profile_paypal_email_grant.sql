-- 081_profile_paypal_email_grant.sql
-- Extends the authenticated role's column-level UPDATE grant on profiles
-- to include paypal_email, added in migration 080.
--
-- Background: migration 047 granted UPDATE on (full_name, phone, avatar_url)
-- only.  PostgREST enforces column-level grants independently of RLS, so
-- without this grant any authenticated client attempting to write paypal_email
-- receives a Postgres permission error even though the RLS UPDATE policy
-- (migration 018: "Users can update their own profile") allows the row.
--
-- Column-level grants in Postgres are additive; this statement extends the
-- existing grant without affecting full_name, phone, or avatar_url.

grant update (paypal_email) on profiles to authenticated;
