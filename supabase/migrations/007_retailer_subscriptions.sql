-- 007_retailer_subscriptions.sql
-- Retailer billing and entitlement state, synced from Stripe

create type retailer_billing_interval as enum ('annual');
create type retailer_subscription_status as enum (
  'inactive', 'active', 'past_due', 'cancelled', 'expired'
);

create table retailer_subscriptions (
  id                    uuid primary key default gen_random_uuid(),
  retailer_id           uuid not null references retailers(id) on delete cascade,
  stripe_customer_id    text,
  stripe_subscription_id text,
  billing_interval      retailer_billing_interval not null default 'annual',
  status                retailer_subscription_status not null default 'inactive',
  current_period_start  timestamptz,
  current_period_end    timestamptz,
  cancel_at_period_end  boolean not null default false,
  started_at            timestamptz,
  ended_at              timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create trigger retailer_subscriptions_updated_at
  before update on retailer_subscriptions
  for each row execute function set_updated_at();
