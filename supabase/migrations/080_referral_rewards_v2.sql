-- 080_referral_rewards_v2.sql
-- Replaces Stripe-credit referral rewards with flat-rate PayPal manual payout.
--
-- Member referral: £2.00 (200p) — paid once the referred member has been active
--   for 30 days without cancelling.
-- Venue referral: £10.00 (1000p) — paid once the referred retailer has been on
--   an active subscription for 30 days.
--
-- Status lifecycle:
--   pending   → reward created at subscription start
--   eligible  → 30-day qualification window passed AND subscription still active
--   paid      → admin has manually processed the PayPal payout
--   cancelled → qualifying subscription cancelled before 30-day window closed
--
-- The old status values (confirmed, applied, voided, review) are kept in the
-- enum for backward compatibility with existing rows; they are not used by new
-- rewards.

-- ── 1. paypal_email on profiles ────────────────────────────────────────────────

alter table profiles add column if not exists paypal_email text;

comment on column profiles.paypal_email is
  'PayPal email address for referral reward payouts. Nullable until member sets it.';

-- ── 2. referred_by_profile_id on retailers ─────────────────────────────────────

alter table retailers add column if not exists referred_by_profile_id uuid
  references profiles(id) on delete set null;

comment on column retailers.referred_by_profile_id is
  'Profile ID of the Better Off Local member who referred this venue.
   Set once at onboarding, immutable after first write. NULL for organic sign-ups.';

create index if not exists retailers_referred_by_profile_idx
  on retailers(referred_by_profile_id)
  where referred_by_profile_id is not null;

-- ── 3. Extend referral_reward_status enum ─────────────────────────────────────

alter type referral_reward_status add value if not exists 'eligible';
alter type referral_reward_status add value if not exists 'paid';

-- ── 4. Alter referral_rewards ─────────────────────────────────────────────────

-- 4a. Make referral_invitation_id nullable: venue rewards have no invitation row.
alter table referral_rewards
  alter column referral_invitation_id drop not null;

-- 4b. Add reward_type column.
alter table referral_rewards
  add column if not exists reward_type text not null default 'member';

alter table referral_rewards
  add constraint referral_rewards_type_values
  check (reward_type in ('member', 'venue'));

-- 4c. Add referred_retailer_id (for venue referral rewards).
alter table referral_rewards
  add column if not exists referred_retailer_id uuid
  references retailers(id) on delete set null;

-- 4d. Lifecycle timestamps and audit columns.
alter table referral_rewards add column if not exists eligible_at timestamptz;
alter table referral_rewards add column if not exists paid_at     timestamptz;
alter table referral_rewards add column if not exists paid_by     uuid references profiles(id) on delete set null;
alter table referral_rewards add column if not exists notes       text;

-- 4e. Unique index: only one reward per referred retailer.
create unique index if not exists referral_rewards_retailer_unique
  on referral_rewards(referred_retailer_id)
  where referred_retailer_id is not null;

-- 4f. Consistency check: member rewards must have invitation, venue rewards must
--     have retailer.  Applied only to rows inserted after this migration runs;
--     existing pending/applied rows already satisfy the member branch.
alter table referral_rewards
  add constraint referral_rewards_type_consistency check (
    (reward_type = 'member'
      and referral_invitation_id is not null
      and referred_retailer_id  is null)
    or
    (reward_type = 'venue'
      and referred_retailer_id  is not null
      and referral_invitation_id is null)
  );

-- ── 5. Helpful indexes ────────────────────────────────────────────────────────

-- NOTE: partial indexes that filter on status = 'eligible' or status = 'paid'
-- cannot be created in this migration because ALTER TYPE ADD VALUE is also in
-- this transaction and the new enum values are not visible within the same
-- transaction in PostgreSQL.  Those indexes live in migration 082.

-- ── 6. RLS for new columns ────────────────────────────────────────────────────

-- profiles.paypal_email: members can read and update their own row.
-- The existing profile RLS policy covers this via the row-level filter
-- "id = auth.uid()", so no additional policy is needed.

-- referral_rewards: existing read policy ("referrer_profile_id = auth.uid()")
-- already covers all columns including the new ones.

-- Admin service-role reads bypass RLS; no changes needed there.
