-- 055_regions.sql
-- Launch regions: drives member-count-gated billing for retailers and venues.
--
-- Threshold = active member count (status in ('active','trialing')).
-- Paying member count (status='active' only) is tracked separately for reporting.
-- Grace period on threshold crossing = 30 days (see migration 057).

create table regions (
  id                uuid    primary key default gen_random_uuid(),
  name              text    not null,
  slug              text    not null unique,
  country           text    not null default 'Scotland',
  postcode_prefixes text[]  not null default '{}',  -- retained for future inference; unused in this batch
  member_threshold  integer not null default 100,    -- admin-editable per region
  is_active         boolean not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create trigger regions_updated_at
  before update on regions
  for each row execute function set_updated_at();

-- Seed: Clackmannanshire is the only active launch region.
-- Remaining regions seeded inactive; admin activates as coverage expands.
insert into regions (name, slug, postcode_prefixes, member_threshold, is_active) values
  ('Clackmannanshire', 'clackmannanshire',
   ARRAY['FK10','FK11','FK12','FK13','FK14'], 100, true),
  ('Stirling', 'stirling',
   ARRAY['FK1','FK2','FK3','FK4','FK5','FK6','FK7','FK8','FK9','FK15','FK16','FK17','FK18','FK19','FK20','FK21'], 100, false),
  ('Perth & Kinross', 'perth-kinross',
   ARRAY['PH1','PH2','PH3','PH4','PH5','PH6','PH7','PH8','PH9','PH10','PH11','PH12','PH13','PH14','PH15','PH16','PH17','PH18'], 100, false),
  ('Fife', 'fife',
   ARRAY['KY1','KY2','KY3','KY4','KY5','KY6','KY7','KY8','KY9','KY10','KY11','KY12','KY13','KY14','KY15','KY16'], 150, false),
  ('Edinburgh', 'edinburgh',
   ARRAY['EH1','EH2','EH3','EH4','EH5','EH6','EH7','EH8','EH9','EH10','EH11','EH12','EH13','EH14','EH15','EH16','EH17'], 250, false);

-- NOTE: region_active_member_count, region_paying_member_count, and
-- region_public_stats are defined in 057_venue_region_billing.sql because they
-- reference profiles.region_id (added in 056) and retailer_locations.region_id
-- (added in 057). Defining them here would fail with "column does not exist".
