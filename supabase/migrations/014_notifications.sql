-- 014_notifications.sql
-- In-app notifications for consumers and operational messages

create table notifications (
  id          uuid primary key default gen_random_uuid(),
  profile_id  uuid not null references profiles(id) on delete cascade,
  type        text not null,
  title       text not null,
  body        text,
  data_json   jsonb,
  sent_at     timestamptz,
  read_at     timestamptz,
  created_at  timestamptz not null default now()
);
