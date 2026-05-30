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

-- ── Member count functions ────────────────────────────────────────────────────

-- Active members (active + trialing) — used for threshold decisions.
create or replace function region_active_member_count(p_region_id uuid)
returns integer
language sql security definer stable set search_path = public, pg_temp as $$
  select count(*)::integer
  from profiles p
  join consumer_memberships cm on cm.profile_id = p.id
  where p.region_id = p_region_id
    and cm.status in ('active', 'trialing')
    and cm.current_period_end > now();
$$;

-- Paying members (active only, no trials) — reporting and dashboard display.
create or replace function region_paying_member_count(p_region_id uuid)
returns integer
language sql security definer stable set search_path = public, pg_temp as $$
  select count(*)::integer
  from profiles p
  join consumer_memberships cm on cm.profile_id = p.id
  where p.region_id = p_region_id
    and cm.status = 'active'
    and cm.current_period_end > now();
$$;

grant execute on function region_active_member_count(uuid) to authenticated, service_role;
grant execute on function region_paying_member_count(uuid) to authenticated, service_role;

-- ── Public progress view (internal for now; grant anon access when public progress page ships) ─

create or replace view region_public_stats as
  select
    r.id,
    r.name,
    r.slug,
    r.country,
    r.member_threshold,
    r.is_active,
    region_active_member_count(r.id)  as active_member_count,
    region_paying_member_count(r.id)  as paying_member_count,
    (
      select count(*)::integer
        from retailers ret
        join retailer_locations rl
          on rl.retailer_id = ret.id and rl.is_primary = true
       where rl.region_id = r.id
         and ret.approval_status = 'approved'
         and ret.visibility_status = 'live'
         and ret.is_active = true
    ) as active_retailer_count,
    (
      select count(*)::integer
        from offers o
        join retailers ret on ret.id = o.retailer_id
        join retailer_locations rl
          on rl.retailer_id = ret.id and rl.is_primary = true
       where rl.region_id = r.id
         and o.status = 'live'
    ) as live_offer_count
  from regions r;

grant select on region_public_stats to service_role, authenticated;
