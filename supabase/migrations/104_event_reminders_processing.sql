-- 104_event_reminders_processing.sql
-- process_event_reminders(): sends 24h and 1h pre-event push/in-app notifications
-- to members who have opted in via event_reminders rows.
--
-- Invoked by pg_cron every 30 minutes (see cron.schedule call below).
-- Also callable via the process-event-reminders edge function for environments
-- where pg_cron is not available.
--
-- Uses insert_notification(profile_id, type, title, body, data_json) defined
-- in migration 061 (service_role only; this function runs as security definer).

create or replace function process_event_reminders()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_rec   record;
  v_event record;
begin
  -- ── 24-hour reminders ──────────────────────────────────────────────────────
  -- Events starting in 22–26 hours (4h window to tolerate cron drift and misses).
  for v_rec in
    select er.id, er.profile_id, er.event_id
      from event_reminders er
      join events e on e.id = er.event_id
     where er.remind_24h_sent = false
       and e.status = 'live'
       and e.start_at between now() + interval '22 hours'
                          and now() + interval '26 hours'
  loop
    select * into v_event from events where id = v_rec.event_id;

    perform insert_notification(
      v_rec.profile_id,
      'event_reminder',
      'Event tomorrow: ' || v_event.title,
      coalesce(v_event.short_summary, 'Your event is tomorrow. Don''t forget!'),
      jsonb_build_object(
        'event_id',      v_rec.event_id::text,
        'reminder_type', '24h'
      )
    );

    update event_reminders set remind_24h_sent = true where id = v_rec.id;
  end loop;

  -- ── 1-hour reminders ───────────────────────────────────────────────────────
  -- Events starting in 50–70 minutes (20-minute window per cron cadence).
  for v_rec in
    select er.id, er.profile_id, er.event_id
      from event_reminders er
      join events e on e.id = er.event_id
     where er.remind_1h_sent = false
       and e.status = 'live'
       and e.start_at between now() + interval '50 minutes'
                          and now() + interval '70 minutes'
  loop
    select * into v_event from events where id = v_rec.event_id;

    perform insert_notification(
      v_rec.profile_id,
      'event_reminder',
      'Starting soon: ' || v_event.title,
      'Your event starts in about 1 hour.',
      jsonb_build_object(
        'event_id',      v_rec.event_id::text,
        'reminder_type', '1h'
      )
    );

    update event_reminders set remind_1h_sent = true where id = v_rec.id;
  end loop;
end;
$$;

-- Restrict execution: called only by pg_cron (superuser) and the edge function
-- (service_role). Revoke from all other roles.
revoke execute on function process_event_reminders() from public, anon, authenticated;
grant  execute on function process_event_reminders() to service_role;

-- ── pg_cron schedule ──────────────────────────────────────────────────────────
-- Run every 30 minutes.
-- Requires pg_cron extension enabled in Supabase project settings.
-- If pg_cron is not available, call the process-event-reminders edge function
-- from an external scheduler instead.
select cron.schedule(
  'process-event-reminders',
  '*/30 * * * *',
  $$select process_event_reminders()$$
);
