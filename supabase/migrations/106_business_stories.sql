create table if not exists business_stories (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references retailers(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 100),
  content text not null check (char_length(content) between 1 and 500),
  image_url text,
  expires_at timestamptz,
  notify_followers boolean not null default false,
  view_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index business_stories_retailer_idx on business_stories (retailer_id, created_at desc);
create index business_stories_active_idx on business_stories (expires_at) where expires_at is not null;

alter table business_stories enable row level security;

-- Authenticated members can read stories for live retailers (not expired)
create policy "members_read_active_stories" on business_stories
  for select to authenticated
  using (
    (expires_at is null or expires_at > now())
    and exists (
      select 1 from retailers r
      where r.id = retailer_id
      and r.visibility_status = 'live'
    )
  );

-- Retailer users can do everything with their own stories
create policy "retailer_manage_own_stories" on business_stories
  for all to authenticated
  using (
    exists (
      select 1 from retailer_users ru
      where ru.retailer_id = business_stories.retailer_id
        and ru.profile_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from retailer_users ru
      where ru.retailer_id = business_stories.retailer_id
        and ru.profile_id = auth.uid()
    )
  );

-- Admins can read all stories
create policy "admin_read_all_stories" on business_stories
  for select to authenticated
  using (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );
