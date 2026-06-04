-- 091_retailer_follows.sql
-- Consumers can follow businesses to get notified when they create new offers.

create table retailer_follows (
  profile_id   uuid not null references profiles(id)  on delete cascade,
  retailer_id  uuid not null references retailers(id) on delete cascade,
  created_at   timestamptz not null default now(),
  primary key (profile_id, retailer_id)
);

create index retailer_follows_retailer_idx on retailer_follows(retailer_id);

comment on table retailer_follows is
  'Members follow businesses to receive in-app notifications when new offers go live.';

alter table retailer_follows enable row level security;

create policy "Member reads own follows"
  on retailer_follows for select to authenticated
  using (profile_id = auth.uid());

create policy "Member inserts own follows"
  on retailer_follows for insert to authenticated
  with check (profile_id = auth.uid());

create policy "Member deletes own follows"
  on retailer_follows for delete to authenticated
  using (profile_id = auth.uid());

-- Service role needs full access for notification fan-out triggers.
grant select on retailer_follows to service_role;
