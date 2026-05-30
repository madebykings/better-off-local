-- 056_profile_region.sql
-- Adds region_id to profiles so member counts can be attributed to regions.
-- Members select their region during mobile onboarding (dropdown, no GPS inference yet).

alter table profiles
  add column region_id uuid references regions(id) on delete set null;

create index idx_profiles_region_id on profiles(region_id) where region_id is not null;

comment on column profiles.region_id is
  'The region this member has selected. Drives regional member counts and home feed.
   Set during mobile onboarding; changeable in account settings.
   Null until the member completes onboarding or sets a preference.';

-- Allow authenticated users to update their own region_id.
-- Server actions use the service role, so this grant is belt-and-braces.
grant update(region_id) on profiles to service_role;
