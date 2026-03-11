-- 009_offer_rules.sql
-- Structured redemption constraints per offer

create table offer_rules (
  id                        uuid primary key default gen_random_uuid(),
  offer_id                  uuid not null references offers(id) on delete cascade,
  max_redemptions_total     integer,
  max_redemptions_per_user  integer,
  max_redemptions_per_day   integer,
  cooldown_hours            integer,
  valid_days_json           jsonb,      -- e.g. ["mon","tue","wed"]
  valid_time_start          time,
  valid_time_end            time,
  new_customers_only        boolean not null default false,
  requires_location_presence boolean not null default false,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),
  unique(offer_id)           -- one rule set per offer
);

create trigger offer_rules_updated_at
  before update on offer_rules
  for each row execute function set_updated_at();
