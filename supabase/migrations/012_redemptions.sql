-- 012_redemptions.sql
-- Completed and attempted redemption events

create type redemption_status as enum (
  'success', 'rejected', 'expired', 'rule_blocked', 'membership_invalid'
);

create table redemptions (
  id                      uuid primary key default gen_random_uuid(),
  profile_id              uuid not null references profiles(id) on delete cascade,
  retailer_id             uuid not null references retailers(id) on delete cascade,
  retailer_location_id    uuid references retailer_locations(id) on delete set null,
  offer_id                uuid not null references offers(id) on delete cascade,
  redemption_token_id     uuid references redemption_tokens(id) on delete set null,
  status                  redemption_status not null,
  rejection_reason        text,
  validated_by_profile_id uuid references profiles(id) on delete set null,
  redeemed_at             timestamptz not null default now(),
  created_at              timestamptz not null default now()
);
