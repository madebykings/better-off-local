-- 048_profile_on_signup.sql
-- Ensures the handle_new_user trigger function and auth trigger exist.
--
-- History: this SQL was originally in 021_profile_on_signup.sql, which
-- collided with the 021_ prefix used by 021_discovery_events.sql. The
-- Supabase CLI cannot track two migrations with the same numeric prefix.
-- The file was removed and recreated here as 048 with idempotent guards
-- so it is safe to run against staging (where the trigger already exists),
-- a fresh db reset, or any repeat execution.

-- ── Trigger function ──────────────────────────────────────────────────────────
-- CREATE OR REPLACE is unconditionally idempotent.

create or replace function handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, role)
  values (
    new.id,
    new.email,
    'consumer'
  )
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

-- ── Auth trigger ──────────────────────────────────────────────────────────────
-- CREATE TRIGGER errors if the trigger already exists, so guard with an
-- existence check. Safe for staging (trigger present), fresh resets (absent),
-- and repeat runs.

do $$
begin
  if not exists (
    select 1 from pg_trigger where tgname = 'on_auth_user_created'
  ) then
    create trigger on_auth_user_created
      after insert on auth.users
      for each row execute function handle_new_user();
  end if;
end
$$;
