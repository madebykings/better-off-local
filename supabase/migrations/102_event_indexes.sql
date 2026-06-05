-- 102_event_indexes.sql
-- Performance indexes for events, event_views, and event_reminders.

-- ── events: consumer-facing queries ──────────────────────────────────────────
-- Region + start time: primary discovery query (upcoming events in region).
create index events_region_start_idx
  on events(region_id, start_at)
  where status = 'live';

-- Region + featured: featured event carousel.
create index events_region_featured_idx
  on events(region_id, is_featured)
  where status = 'live';

-- Retailer portal: list own events by status.
create index events_retailer_status_idx
  on events(retailer_id, status);

-- Admin moderation queue: pending/draft review.
create index events_status_start_idx
  on events(status, start_at);

-- ── event_views: analytics aggregation ───────────────────────────────────────
create index event_views_event_id_idx
  on event_views(event_id);

-- ── event_reminders: reminder processing ─────────────────────────────────────
-- Partial indexes keep the cron-style reminder queries fast
-- by excluding already-sent reminders.
create index event_reminders_due_24h_idx
  on event_reminders(event_id)
  where remind_24h_sent = false;

create index event_reminders_due_1h_idx
  on event_reminders(event_id)
  where remind_1h_sent = false;
