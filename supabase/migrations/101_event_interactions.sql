-- 101_event_interactions.sql
-- event_views: anonymous analytics tracking of event page visits.
-- event_reminders: members opt-in to receive push/in-app reminders before events.

-- ── event_views ───────────────────────────────────────────────────────────────

create table event_views (
  id         uuid primary key default gen_random_uuid(),
  event_id   uuid not null references events(id) on delete cascade,
  profile_id uuid references profiles(id) on delete set null,
  viewed_at  timestamptz not null default now()
);

-- ── event_reminders ───────────────────────────────────────────────────────────
-- Members register for 24h and 1h pre-event push notifications.
-- remind_*_sent flags are set by process_event_reminders() (migration 104).

create table event_reminders (
  id               uuid primary key default gen_random_uuid(),
  event_id         uuid not null references events(id) on delete cascade,
  profile_id       uuid not null references profiles(id) on delete cascade,
  remind_24h_sent  boolean not null default false,
  remind_1h_sent   boolean not null default false,
  created_at       timestamptz not null default now(),
  unique(event_id, profile_id)
);

-- ── RLS: event_views ─────────────────────────────────────────────────────────

alter table event_views enable row level security;

-- Anyone can insert a view (analytics); no read needed client-side.
create policy "event_views_insert" on event_views
  for insert with check (true);

-- ── RLS: event_reminders ─────────────────────────────────────────────────────

alter table event_reminders enable row level security;

-- Consumers manage their own reminders (insert, update, delete).
create policy "event_reminders_own" on event_reminders
  for all using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

-- Authenticated users can read their own reminders.
create policy "event_reminders_read" on event_reminders
  for select using (profile_id = auth.uid());

-- ── Grants ────────────────────────────────────────────────────────────────────

grant select, insert, delete on event_reminders to authenticated;
grant insert on event_views to authenticated, anon;
