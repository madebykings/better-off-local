-- 062_regions_rls.sql
-- Adds RLS to the regions table so authenticated and anon users can read it.
--
-- Root cause: regions was created in 055 after migration 018 (which enabled RLS
-- on all tables that existed at that point). Without a permissive SELECT policy,
-- Supabase's PostgREST returns 0 rows to authenticated/anon roles even when
-- a table-level GRANT SELECT exists. The grant alone is insufficient — a policy
-- is also required. This matches the pattern used for categories in 018.

alter table regions enable row level security;

create policy "Anyone can read active regions"
  on regions for select
  to authenticated, anon
  using (is_active = true);

create policy "Service role and admins can manage regions"
  on regions for all
  to service_role
  using (true)
  with check (true);
