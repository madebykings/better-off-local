-- 083_loyalty_schema.sql
-- Loyalty Visits offer type: stamp-card system where members earn one stamp per
-- verified scanner redemption and claim a reward after reaching the target count.
--
-- Design principles:
--   - Every stamp originates from a successful scanner scan (backed by a
--     loyalty_stamps row AND a redemptions row).  Counters are derived from the
--     audit trail — never incremented directly by client code.
--   - loyalty_cards.stamps_earned is a denormalised cache kept in sync by the
--     process_loyalty_stamp RPC.  In a dispute it can be recomputed as
--     COUNT(*) FROM loyalty_stamps WHERE loyalty_card_id = <id>.
--   - Reward claims reuse the existing redemptions table and QR token flow.
--     No parallel redemption system is introduced.
--
-- IMPORTANT: ALTER TYPE … ADD VALUE must not share a transaction with queries
-- that use the new value.  This migration adds the enum value only; the RPC
-- that inserts loyalty rows lives in migration 084.

-- ── 1. Extend offer_type enum ─────────────────────────────────────────────────

alter type offer_type add value if not exists 'loyalty_visits';

-- ── 2. loyalty_card_status enum ──────────────────────────────────────────────

create type loyalty_card_status as enum (
  'active',     -- collecting stamps
  'completed',  -- all stamps earned; reward not yet claimed
  'claimed',    -- reward redeemed at scanner
  'expired'     -- offer end_at passed before reward was claimed
);

-- ── 3. offer_loyalty_config ───────────────────────────────────────────────────
-- One row per loyalty offer.  Defines the stamp target and reward.
-- Managed by the retailer portal; editable by admin.

create table offer_loyalty_config (
  id                       uuid        primary key default gen_random_uuid(),
  offer_id                 uuid        not null references offers(id) on delete cascade,
  stamps_required          integer     not null check (stamps_required between 2 and 20),
  reward_description       text        not null,
  reward_type              text        not null
                             check (reward_type in ('free_item','percentage_discount','fixed_discount')),
  reward_value_text        text,
  min_hours_between_stamps integer     not null default 0
                             check (min_hours_between_stamps >= 0),
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  unique(offer_id)
);

create trigger offer_loyalty_config_updated_at
  before update on offer_loyalty_config
  for each row execute function set_updated_at();

comment on table offer_loyalty_config is
  'Stamp-card configuration for loyalty_visits offers.
   One row per offer.  stamps_required is the target before reward.
   min_hours_between_stamps is the anti-fraud cooldown between stamps per member.';

-- ── 4. loyalty_cards ─────────────────────────────────────────────────────────
-- One row per member per loyalty offer.  Created on first stamp scan.
-- SELECT … FOR UPDATE is used by process_loyalty_stamp to prevent race conditions.

create table loyalty_cards (
  id                   uuid                 primary key default gen_random_uuid(),
  profile_id           uuid                 not null references profiles(id) on delete cascade,
  offer_id             uuid                 not null references offers(id) on delete cascade,
  retailer_id          uuid                 not null references retailers(id) on delete cascade,
  stamps_earned        integer              not null default 0 check (stamps_earned >= 0),
  stamps_required      integer              not null,
  status               loyalty_card_status  not null default 'active',
  completed_at         timestamptz,
  claimed_at           timestamptz,
  reward_redemption_id uuid                 references redemptions(id) on delete set null,
  created_at           timestamptz          not null default now(),
  updated_at           timestamptz          not null default now(),
  unique(profile_id, offer_id)
);

create trigger loyalty_cards_updated_at
  before update on loyalty_cards
  for each row execute function set_updated_at();

create index loyalty_cards_profile_idx  on loyalty_cards(profile_id);
create index loyalty_cards_offer_idx    on loyalty_cards(offer_id);
create index loyalty_cards_retailer_idx on loyalty_cards(retailer_id);
create index loyalty_cards_status_idx   on loyalty_cards(profile_id, status);

comment on table loyalty_cards is
  'One loyalty card per member per offer.  Created on first stamp scan.
   stamps_earned is kept in sync by process_loyalty_stamp RPC.
   Source of truth for stamp count is loyalty_stamps (COUNT(*) WHERE loyalty_card_id).';

comment on column loyalty_cards.reward_redemption_id is
  'Set when the member claims their reward: links to the success row in redemptions.';

-- ── 5. loyalty_stamps ────────────────────────────────────────────────────────
-- Immutable audit trail.  One row per stamp earned.
-- Every row references a redemption row (the scanner validation event).

create table loyalty_stamps (
  id                    uuid        primary key default gen_random_uuid(),
  loyalty_card_id       uuid        not null references loyalty_cards(id) on delete cascade,
  redemption_id         uuid        references redemptions(id) on delete set null,
  stamped_by_profile_id uuid        references profiles(id) on delete set null,
  retailer_location_id  uuid        references retailer_locations(id) on delete set null,
  stamped_at            timestamptz not null default now()
);

create index loyalty_stamps_card_idx on loyalty_stamps(loyalty_card_id);
create index loyalty_stamps_time_idx on loyalty_stamps(loyalty_card_id, stamped_at desc);

comment on table loyalty_stamps is
  'Immutable stamp audit trail.  One row per stamp earned.
   stamped_by_profile_id is the retailer/scanner user who processed the scan.
   redemption_id links to the redemptions row created in the same transaction.';

-- ── 6. RLS ───────────────────────────────────────────────────────────────────

alter table offer_loyalty_config enable row level security;
alter table loyalty_cards        enable row level security;
alter table loyalty_stamps       enable row level security;

-- offer_loyalty_config: public read (consumers see stamp count on offer detail).
-- Writes are service_role only (retailer portal and admin use service client).
create policy "Public reads offer loyalty config"
  on offer_loyalty_config for select
  using (true);

-- loyalty_cards: member reads own cards.
create policy "Member reads own loyalty cards"
  on loyalty_cards for select
  to authenticated
  using (profile_id = auth.uid());

-- loyalty_stamps: member reads stamps on own cards.
create policy "Member reads own loyalty stamps"
  on loyalty_stamps for select
  to authenticated
  using (
    loyalty_card_id in (
      select id from loyalty_cards where profile_id = auth.uid()
    )
  );

-- ── 7. Grants ─────────────────────────────────────────────────────────────────

grant select on offer_loyalty_config to anon, authenticated;
grant select on loyalty_cards        to authenticated;
grant select on loyalty_stamps       to authenticated;

-- Service role (used by RPCs and retailer portal server actions):
grant all on offer_loyalty_config to service_role;
grant all on loyalty_cards        to service_role;
grant all on loyalty_stamps       to service_role;
