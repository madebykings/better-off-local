-- 010_favourites.sql
-- Consumer saved retailers and offers

create table favourites (
  id          uuid primary key default gen_random_uuid(),
  profile_id  uuid not null references profiles(id) on delete cascade,
  retailer_id uuid references retailers(id) on delete cascade,
  offer_id    uuid references offers(id) on delete cascade,
  created_at  timestamptz not null default now(),
  -- at least one target must be set
  constraint favourites_target_check check (
    retailer_id is not null or offer_id is not null
  ),
  -- prevent duplicates per target type
  unique nulls not distinct (profile_id, retailer_id, offer_id)
);
