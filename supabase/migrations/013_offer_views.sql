-- 013_offer_views.sql
-- Analytics tracking for consumer offer views

create table offer_views (
  id          uuid primary key default gen_random_uuid(),
  profile_id  uuid references profiles(id) on delete set null,
  offer_id    uuid not null references offers(id) on delete cascade,
  retailer_id uuid not null references retailers(id) on delete cascade,
  viewed_at   timestamptz not null default now()
);
