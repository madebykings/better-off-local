-- 096_retailer_invitations_rls.sql
-- Enable Row Level Security on retailer_invitations.
--
-- Without RLS any authenticated user can read all invitation rows, which
-- exposes email addresses and invite tokens.  This migration locks the table
-- down to:
--   SELECT  — the invited person (by email) OR any team member of the retailer
--   INSERT  — owner of the retailer only
--   UPDATE  — owner of the retailer only (e.g. to revoke an invitation)
--   DELETE  — owner of the retailer only
--
-- Note: the team membership table is `retailer_users` (access_role column of
-- type retailer_access_role enum: 'owner', 'manager', 'scanner_only', 'staff').
-- The invitation email column is `email` (see migration 094).

alter table retailer_invitations enable row level security;

-- ── SELECT ─────────────────────────────────────────────────────────────────────
-- Invited person (matched by email) OR any team member of the retailer.

create policy "Invited user or team member can read invitation"
  on retailer_invitations
  for select
  to authenticated
  using (
    -- The row is addressed to this authenticated user's email address
    email = auth.jwt() ->> 'email'
    or
    -- Or the user is any member of the retailer's team
    exists (
      select 1
        from retailer_users ru
       where ru.profile_id  = auth.uid()
         and ru.retailer_id = retailer_invitations.retailer_id
         and ru.is_active   = true
    )
  );

-- ── INSERT ─────────────────────────────────────────────────────────────────────
-- Only an owner of the retailer may create invitations.

create policy "Retailer owner can create invitation"
  on retailer_invitations
  for insert
  to authenticated
  with check (
    exists (
      select 1
        from retailer_users ru
       where ru.profile_id  = auth.uid()
         and ru.retailer_id = retailer_invitations.retailer_id
         and ru.access_role = 'owner'
         and ru.is_active   = true
    )
  );

-- ── UPDATE ─────────────────────────────────────────────────────────────────────
-- Only an owner of the retailer may update/cancel invitations.

create policy "Retailer owner can update invitation"
  on retailer_invitations
  for update
  to authenticated
  using (
    exists (
      select 1
        from retailer_users ru
       where ru.profile_id  = auth.uid()
         and ru.retailer_id = retailer_invitations.retailer_id
         and ru.access_role = 'owner'
         and ru.is_active   = true
    )
  )
  with check (
    exists (
      select 1
        from retailer_users ru
       where ru.profile_id  = auth.uid()
         and ru.retailer_id = retailer_invitations.retailer_id
         and ru.access_role = 'owner'
         and ru.is_active   = true
    )
  );

-- ── DELETE ─────────────────────────────────────────────────────────────────────
-- Only an owner of the retailer may delete invitations.

create policy "Retailer owner can delete invitation"
  on retailer_invitations
  for delete
  to authenticated
  using (
    exists (
      select 1
        from retailer_users ru
       where ru.profile_id  = auth.uid()
         and ru.retailer_id = retailer_invitations.retailer_id
         and ru.access_role = 'owner'
         and ru.is_active   = true
    )
  );
