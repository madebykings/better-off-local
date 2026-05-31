-- 067_profile_region_update_grant.sql
-- Adds region_id to the column-level UPDATE grant on profiles for authenticated.
--
-- Root cause: migration 056 added region_id to profiles and granted UPDATE(region_id)
-- to service_role only. The mobile app runs as the authenticated role, so every
-- setRegion() call from the app failed with "permission denied for table profiles"
-- (PostgREST 403). The error was swallowed by a generic catch block, surfacing
-- only as "Could not save region. Please try again."
--
-- Migration 047 already established the column-level grant pattern for safe profile
-- fields (full_name, phone, avatar_url). This extends it with region_id.
--
-- The existing RLS UPDATE policy ("Users can update their own profile" from 018)
-- restricts updates to rows where id = auth.uid(), so only the member's own
-- region_id can be changed.

grant update(region_id) on profiles to authenticated;
