-- 100_events.sql
-- Retailer-created events visible to consumers.
-- Moderation workflow mirrors offers: draft → pending → live/rejected.
-- venue_id links to retailer_locations for map-readiness.
--
-- SCHEMA NOTE: retailer_users (not retailer_team_members) is the table that
-- links platform users to retailers. retailer_access_role enum values are
-- 'owner', 'manager', 'staff', 'scanner_only' (no 'admin' value).

create table events (
  id               uuid primary key default gen_random_uuid(),
  retailer_id      uuid not null references retailers(id) on delete cascade,
  venue_id         uuid references retailer_locations(id) on delete set null,
  region_id        uuid not null references regions(id),
  title            text not null,
  short_summary    text,
  description      text,
  event_type       text not null default 'other',
  start_at         timestamptz not null,
  end_at           timestamptz,
  image_url        text,
  booking_url      text,
  is_featured      boolean not null default false,
  status           text not null default 'draft'
                     check (status in ('draft','pending','live','paused','rejected','archived')),
  review_notes     text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- Reuse the existing set_updated_at() trigger function (defined in 002_profiles.sql).
create trigger events_updated_at
  before update on events
  for each row execute function set_updated_at();

-- ── RLS ───────────────────────────────────────────────────────────────────────

alter table events enable row level security;

-- Public: read live events
create policy "events_public_read" on events
  for select using (status = 'live');

-- Retailer users: read own events (any status)
-- Uses retailer_users (actual table name) not retailer_team_members.
create policy "events_retailer_read_own" on events
  for select using (
    exists (
      select 1 from retailer_users ru
       where ru.retailer_id = events.retailer_id
         and ru.profile_id = auth.uid()
         and ru.is_active = true
    )
  );

-- Retailer users: write own events (insert/update/delete for draft/pending/paused states)
-- access_role restricted to 'owner' and 'manager' (retailer_access_role enum has no 'admin').
create policy "events_retailer_write_own" on events
  for all using (
    exists (
      select 1 from retailer_users ru
       where ru.retailer_id = events.retailer_id
         and ru.profile_id = auth.uid()
         and ru.is_active = true
         and ru.access_role in ('owner','manager')
    )
  ) with check (
    status in ('draft','pending') and
    exists (
      select 1 from retailer_users ru
       where ru.retailer_id = events.retailer_id
         and ru.profile_id = auth.uid()
         and ru.is_active = true
         and ru.access_role in ('owner','manager')
    )
  );

-- Service role: full access (moderation, admin actions)
-- service_role bypasses RLS by default — no policy needed.

-- ── Grants ────────────────────────────────────────────────────────────────────
-- Write grants go through server actions / service_role only.
grant select on events to authenticated, anon;
