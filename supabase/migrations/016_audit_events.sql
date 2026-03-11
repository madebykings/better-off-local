-- 016_audit_events.sql
-- Cross-cutting audit log for critical platform events

create table audit_events (
  id            uuid primary key default gen_random_uuid(),
  actor_id      uuid references profiles(id) on delete set null,
  event_type    text not null,
  target_table  text,
  target_id     uuid,
  metadata_json jsonb,
  ip_address    text,
  created_at    timestamptz not null default now()
);
