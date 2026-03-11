-- 015_admin_actions.sql
-- Internal admin moderation decisions and actions

create table admin_actions (
  id                uuid primary key default gen_random_uuid(),
  admin_profile_id  uuid not null references profiles(id) on delete cascade,
  action_type       text not null,
  target_table      text not null,
  target_id         uuid not null,
  reason            text,
  metadata_json     jsonb,
  created_at        timestamptz not null default now()
);
