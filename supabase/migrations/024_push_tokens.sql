-- 024_push_tokens.sql
-- Device push token registry for FCM/APNs notifications

create table push_tokens (
  id          uuid primary key default gen_random_uuid(),
  profile_id  uuid not null references profiles(id) on delete cascade,
  token       text not null,
  platform    text not null check (platform in ('ios', 'android')),
  updated_at  timestamptz not null default now(),
  created_at  timestamptz not null default now(),
  unique (profile_id, token)
);

alter table push_tokens enable row level security;

-- Users can manage their own tokens
create policy "push_tokens: owner access"
  on push_tokens
  for all
  using (auth.uid() = profile_id)
  with check (auth.uid() = profile_id);

-- Service role can read all (for sending notifications)
create policy "push_tokens: service role read"
  on push_tokens
  for select
  using (auth.role() = 'service_role');

-- Index for efficient lookup by profile
create index push_tokens_profile_id_idx on push_tokens(profile_id);
