-- 025_notification_indexes.sql
-- Performance indexes for notifications queries

-- Fast unread count and list for a profile (ordered by created_at desc)
create index notifications_profile_unread_idx
  on notifications(profile_id, created_at desc)
  where read_at is null;

-- General profile notifications list
create index notifications_profile_created_idx
  on notifications(profile_id, created_at desc);
