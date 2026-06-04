-- 085_venue_referral_schema.sql
-- Venue Referral Rewards — a first-class offer type where a member refers
-- friends to a specific venue/offer. When the referred friend makes their
-- first redemption at that venue, the referrer's reward unlocks and can be
-- redeemed via the existing QR scanner flow.
--
-- This is distinct from:
--   • Platform member referrals (£2/friend for joining the platform)
--   • Venue referrals (£10 for recruiting a retailer to the platform)
--
-- IMPORTANT: ALTER TYPE … ADD VALUE must not share a transaction with queries
-- that use the new value.  RPCs that reference 'venue_referral' live in 086.

-- ── 1. Extend offer_type enum ─────────────────────────────────────────────────

alter type offer_type add value if not exists 'venue_referral';

-- ── 2. venue_referral_share_tokens ────────────────────────────────────────────
-- One share token per (referrer, offer) pair.
-- Generated lazily when the member first opens the offer and taps Share.
-- The token is embedded in the share URL so any invitee click can be attributed.

create table venue_referral_share_tokens (
  id                   uuid        primary key default gen_random_uuid(),
  offer_id             uuid        not null references offers(id) on delete cascade,
  referrer_profile_id  uuid        not null references profiles(id) on delete cascade,
  token                text        not null,
  created_at           timestamptz not null default now(),
  unique(offer_id, referrer_profile_id),
  unique(token)
);

create index venue_referral_share_tokens_token_idx   on venue_referral_share_tokens(token);
create index venue_referral_share_tokens_offer_idx   on venue_referral_share_tokens(offer_id);
create index venue_referral_share_tokens_profile_idx on venue_referral_share_tokens(referrer_profile_id);

comment on table venue_referral_share_tokens is
  'One share token per (referrer, offer) pair. Generated lazily on first share.
   Token is embedded in the invite URL so any invitee click can be attributed
   back to the correct referrer.';

-- ── 3. venue_referral_invitations ─────────────────────────────────────────────
-- Recorded when an invitee clicks a referral link and is identified (logged in
-- or newly signed up).  Unique(offer_id, invitee_profile_id) prevents an invitee
-- being attributed to multiple referrers for the same offer.

create table venue_referral_invitations (
  id                   uuid        primary key default gen_random_uuid(),
  offer_id             uuid        not null references offers(id) on delete cascade,
  referrer_profile_id  uuid        not null references profiles(id),
  invitee_profile_id   uuid        not null references profiles(id),
  share_token          text        not null,
  attributed_at        timestamptz not null default now(),
  unique(offer_id, invitee_profile_id)
);

create index venue_referral_invitations_offer_idx    on venue_referral_invitations(offer_id);
create index venue_referral_invitations_referrer_idx on venue_referral_invitations(referrer_profile_id);
create index venue_referral_invitations_invitee_idx  on venue_referral_invitations(invitee_profile_id);

comment on table venue_referral_invitations is
  'One row per (offer, invitee) attribution. Created when an invitee lands on the
   share link and is identified. Prevents double-attribution for the same offer.
   attributed_at is the server timestamp; used as the new-customer cutoff.';

-- ── 4. venue_referral_rewards ─────────────────────────────────────────────────
-- One reward per invitation, created when the new-customer check passes
-- (invitee made their first successful redemption at the venue AFTER attribution
-- with zero prior redemptions at that retailer before attributed_at).

create table venue_referral_rewards (
  id                   uuid        primary key default gen_random_uuid(),
  invitation_id        uuid        not null unique references venue_referral_invitations(id),
  offer_id             uuid        not null references offers(id),
  referrer_profile_id  uuid        not null references profiles(id),
  status               text        not null
                         check (status in ('unlocked','redeemed','voided')),
  unlocked_at          timestamptz not null default now(),
  redeemed_at          timestamptz,
  redemption_id        uuid        references redemptions(id) on delete set null,
  voided_at            timestamptz,
  void_reason          text,
  voided_by            uuid        references profiles(id) on delete set null,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create index venue_referral_rewards_referrer_idx
  on venue_referral_rewards(referrer_profile_id, status);
create index venue_referral_rewards_offer_idx
  on venue_referral_rewards(offer_id);
create index venue_referral_rewards_unlocked_idx
  on venue_referral_rewards(referrer_profile_id, offer_id)
  where status = 'unlocked';

create trigger venue_referral_rewards_updated_at
  before update on venue_referral_rewards
  for each row execute function set_updated_at();

comment on table venue_referral_rewards is
  'One reward per invitation, unlocked when new-customer check passes.
   status: unlocked → redeemed (via QR scan) | voided (admin action).
   redemption_id is set when the referrer redeems the reward at the venue.';

-- ── 5. RLS ────────────────────────────────────────────────────────────────────

alter table venue_referral_share_tokens enable row level security;
alter table venue_referral_invitations  enable row level security;
alter table venue_referral_rewards      enable row level security;

-- Share tokens: referrer reads their own tokens
create policy "Referrer reads own share tokens"
  on venue_referral_share_tokens for select
  to authenticated
  using (referrer_profile_id = auth.uid());

-- Invitations: referrer reads invitations linked to their tokens
create policy "Referrer reads own invitations"
  on venue_referral_invitations for select
  to authenticated
  using (referrer_profile_id = auth.uid());

-- Rewards: referrer reads their own rewards
create policy "Referrer reads own venue referral rewards"
  on venue_referral_rewards for select
  to authenticated
  using (referrer_profile_id = auth.uid());

-- ── 6. Grants ─────────────────────────────────────────────────────────────────

grant select on venue_referral_share_tokens to authenticated;
grant select on venue_referral_invitations  to authenticated;
grant select on venue_referral_rewards      to authenticated;

grant all on venue_referral_share_tokens to service_role;
grant all on venue_referral_invitations  to service_role;
grant all on venue_referral_rewards      to service_role;
