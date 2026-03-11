-- 002_profiles.sql
-- Platform user profiles linked to Supabase auth users

create type user_role as enum ('consumer', 'retailer_user', 'admin');

create table profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  role        user_role not null default 'consumer',
  full_name   text,
  email       text,
  phone       text,
  avatar_url  text,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- updated_at trigger function (reused across tables)
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger profiles_updated_at
  before update on profiles
  for each row execute function set_updated_at();
