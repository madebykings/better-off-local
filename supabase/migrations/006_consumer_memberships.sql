-- 006_consumer_memberships.sql
-- Consumer subscription state, synced from Stripe

create type membership_plan_interval as enum ('monthly', 'annual');
create type membership_status as enum (
  'inactive', 'trialing', 'active', 'past_due', 'cancelled', 'expired'
);

create table consumer_memberships (
  id                    uuid primary key default gen_random_uuid(),
  profile_id            uuid not null references profiles(id) on delete cascade,
  stripe_customer_id    text,
  stripe_subscription_id text,
  plan_interval         membership_plan_interval,
  status                membership_status not null default 'inactive',
  current_period_start  timestamptz,
  current_period_end    timestamptz,
  cancel_at_period_end  boolean not null default false,
  started_at            timestamptz,
  ended_at              timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create trigger consumer_memberships_updated_at
  before update on consumer_memberships
  for each row execute function set_updated_at();
