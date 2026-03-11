-- 005_retailer_locations.sql
-- Physical business locations for retailers

create table retailer_locations (
  id                  uuid primary key default gen_random_uuid(),
  retailer_id         uuid not null references retailers(id) on delete cascade,
  name                text,
  address_line_1      text,
  address_line_2      text,
  town                text,
  county              text,
  postcode            text,
  country             text not null default 'Scotland',
  latitude            numeric(10, 7),
  longitude           numeric(10, 7),
  google_place_id     text,
  is_primary          boolean not null default false,
  is_active           boolean not null default true,
  opening_hours_json  jsonb,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create trigger retailer_locations_updated_at
  before update on retailer_locations
  for each row execute function set_updated_at();
