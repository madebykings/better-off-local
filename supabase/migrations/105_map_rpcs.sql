-- 105_map_rpcs.sql
-- get_map_events: returns live upcoming events with venue coordinates for MAP 2.0.
-- Used by the Flutter discovery map to show event markers with lat/lng.

create or replace function get_map_events(
  p_region_id   uuid,
  p_consumer_id uuid default null
)
returns table (
  event_id      uuid,
  title         text,
  event_type    text,
  image_url     text,
  short_summary text,
  venue_lat     numeric,
  venue_lng     numeric,
  venue_name    text,
  retailer_id   uuid,
  start_at      timestamptz,
  end_at        timestamptz,
  has_reminder  boolean
)
language sql stable security definer
set search_path = public
as $$
  select
    e.id                              as event_id,
    e.title,
    e.event_type,
    e.image_url,
    e.short_summary,
    rl.latitude::numeric              as venue_lat,
    rl.longitude::numeric             as venue_lng,
    rl.name                           as venue_name,
    e.retailer_id,
    e.start_at,
    e.end_at,
    case
      when p_consumer_id is null then false
      else exists (
        select 1 from event_reminders er
         where er.event_id = e.id
           and er.profile_id = p_consumer_id
      )
    end                               as has_reminder
  from events e
  join retailer_locations rl on rl.id = e.venue_id
  where e.region_id = p_region_id
    and e.status    = 'live'
    and e.start_at  > now()
    and rl.latitude  is not null
    and rl.longitude is not null
  order by e.start_at
  limit 100;
$$;

grant execute on function get_map_events(uuid, uuid) to authenticated, anon;
