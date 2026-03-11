-- 021_profile_on_signup.sql
-- Automatically create a profile row when a new auth user is created.
-- The default role is 'consumer'. Admin and retailer_user roles are
-- assigned out-of-band (admin via service key, retailer_user via retailer_users table).

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

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();
