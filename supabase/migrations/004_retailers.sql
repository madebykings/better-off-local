-- 004_retailers.sql
-- Retailer entities, retailer-user links, and category assignments

create type retailer_approval_status as enum ('pending', 'approved', 'rejected', 'suspended');
create type retailer_visibility_status as enum ('draft', 'live', 'hidden');
create type retailer_access_role as enum ('owner', 'manager', 'staff');

create table retailers (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null,
  slug                text not null unique,
  description         text,
  short_description   text,
  logo_url            text,
  cover_image_url     text,
  website_url         text,
  phone               text,
  email               text,
  is_active           boolean not null default true,
  approval_status     retailer_approval_status not null default 'pending',
  visibility_status   retailer_visibility_status not null default 'draft',
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create trigger retailers_updated_at
  before update on retailers
  for each row execute function set_updated_at();

-- Links platform users to retailers
create table retailer_users (
  id          uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references retailers(id) on delete cascade,
  profile_id  uuid not null references profiles(id) on delete cascade,
  access_role retailer_access_role not null default 'staff',
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique(retailer_id, profile_id)
);

create trigger retailer_users_updated_at
  before update on retailer_users
  for each row execute function set_updated_at();

-- Category assignments for retailers
create table retailer_categories (
  id          uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references retailers(id) on delete cascade,
  category_id uuid not null references categories(id) on delete cascade,
  created_at  timestamptz not null default now(),
  unique(retailer_id, category_id)
);
