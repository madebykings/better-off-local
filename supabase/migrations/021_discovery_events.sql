-- 021_discovery_events.sql
-- Lightweight analytics for map and discovery interactions.
-- Rows are fire-and-forget inserts from the mobile app.

create table discovery_events (
  id           uuid primary key default gen_random_uuid(),
  profile_id   uuid references profiles(id) on delete set null,
  event_type   text not null check (event_type in (
                 'map_viewed',
                 'marker_opened',
                 'retailer_opened_from_map',
                 'search_used')),
  retailer_id  uuid references retailers(id) on delete cascade,
  metadata     jsonb,
  created_at   timestamptz not null default now()
);

-- Any authenticated or anonymous session may insert their own events.
alter table discovery_events enable row level security;

create policy "Anyone can insert discovery events"
  on discovery_events for insert
  with check (true);
