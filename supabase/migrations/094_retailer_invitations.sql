-- 094_retailer_invitations.sql
-- Role-based email invitations for retailer team members.
-- Supports inviting owner, manager, and scanner_only roles by email.
-- Unlike scanner_invites (link-based), these are single-use, email-targeted.

create table retailer_invitations (
  id           uuid        primary key default gen_random_uuid(),
  retailer_id  uuid        not null references retailers(id) on delete cascade,
  invited_by   uuid        not null references profiles(id),
  email        text        not null,
  role         text        not null check (role in ('owner', 'manager', 'scanner_only')),
  token        text        not null unique,
  status       text        not null default 'pending'
                             check (status in ('pending', 'accepted', 'revoked')),
  expires_at   timestamptz not null,
  created_at   timestamptz not null default now()
);

create index retailer_invitations_retailer_id_idx on retailer_invitations (retailer_id);
create index retailer_invitations_token_idx       on retailer_invitations (token);
create index retailer_invitations_email_idx       on retailer_invitations (email);
