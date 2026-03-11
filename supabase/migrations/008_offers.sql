-- 008_offers.sql
-- Consumer-facing offers created by retailers

create type offer_type as enum (
  'percentage_discount', 'fixed_discount', 'free_item', 'bundle', 'other'
);

create type offer_status as enum (
  'draft', 'pending', 'approved', 'live', 'expired', 'rejected', 'paused'
);

create table offers (
  id                      uuid primary key default gen_random_uuid(),
  retailer_id             uuid not null references retailers(id) on delete cascade,
  retailer_location_id    uuid references retailer_locations(id) on delete set null,
  title                   text not null,
  short_summary           text,
  description             text,
  offer_type              offer_type not null default 'other',
  value_text              text,
  terms_text              text,
  start_at                timestamptz,
  end_at                  timestamptz,
  status                  offer_status not null default 'draft',
  approval_required       boolean not null default true,
  is_featured             boolean not null default false,
  image_url               text,
  created_by_profile_id   uuid references profiles(id) on delete set null,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

create trigger offers_updated_at
  before update on offers
  for each row execute function set_updated_at();
