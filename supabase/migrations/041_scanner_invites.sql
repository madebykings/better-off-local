-- 041_scanner_invites.sql
-- Reusable invite links that let retailer owners share a URL with staff.
-- Staff open the link, authenticate via magic link, enter a display name,
-- and are attached to the retailer as scanner_only users.
--
-- Design notes:
-- - token is stored in plain text; unpredictability (32 random bytes) is the
--   security property rather than hashing, given scanner_only blast radius.
-- - max_uses is nullable: null = unlimited within the 7-day expiry window.
-- - use_count is incremented each time a new retailer_users row is created.
-- - One active link per retailer is enforced in application logic (old links
--   are revoked when a new one is generated) but not at the DB level.

create table scanner_invites (
  id           uuid        primary key default gen_random_uuid(),
  retailer_id  uuid        not null references retailers(id) on delete cascade,
  created_by   uuid        not null references profiles(id),
  token        text        not null unique,
  expires_at   timestamptz not null,
  is_revoked   boolean     not null default false,
  max_uses     integer,                             -- null = unlimited
  use_count    integer     not null default 0,      -- incremented on each acceptance
  created_at   timestamptz not null default now()
);

create index scanner_invites_retailer_id_idx on scanner_invites (retailer_id);
create index scanner_invites_token_idx       on scanner_invites (token);
