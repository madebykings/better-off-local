-- 063_scanner_invites_rls.sql
-- Enables RLS on scanner_invites and adds scoped read policies.
--
-- scanner_invites was created in 041 without RLS, leaving it unprotected
-- against any future authenticated SELECT grant. Raw tokens must not be
-- exposed to arbitrary authenticated users.
--
-- Access model:
--   Reads  — retailer owners/managers see their own retailer's invites
--            (token is visible to them so they can share the invite URL)
--   Reads  — admins can read all rows for support/audit
--   Writes — all writes go through edge functions using service_role;
--            no client-side INSERT/UPDATE/DELETE policies are defined
--   Anon   — no access

alter table scanner_invites enable row level security;

-- Retailer owners and managers can read invites for their own retailer.
-- scanner_only users are intentionally excluded — they accept invites but
-- have no business need to view or regenerate them.
create policy "Retailer owners can read own scanner invites"
  on scanner_invites for select
  to authenticated
  using (
    exists (
      select 1
        from retailer_users ru
       where ru.retailer_id = scanner_invites.retailer_id
         and ru.profile_id  = auth.uid()
         and ru.is_active   = true
         and ru.access_role in ('owner', 'manager')
    )
  );

create policy "Admins can read all scanner invites"
  on scanner_invites for select
  to authenticated
  using (is_admin());

-- Grant SELECT so PostgREST can serve the policies above.
-- INSERT/UPDATE/DELETE are intentionally omitted — managed via service_role only.
grant select on scanner_invites to authenticated;
