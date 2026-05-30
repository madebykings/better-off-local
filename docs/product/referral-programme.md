# Referral Programme — Planning Note

**Status: Planned — do not implement until retailer offer management is tested.**

---

## Overview

Members can invite friends to join Better Off Local. When a friend joins and becomes a paying member, the referrer earns a reward (e.g. one month free). This is a growth mechanic that leverages the existing membership base.

---

## 1. Consumer Referral Model

### Referral code / link

- Each member gets a unique referral code generated at membership creation (or lazily on first access to the referral screen).
- The share link is a deep link: `betterofflocal.app/join?ref=<code>` — deferred into the app on install so attribution survives the App Store/Play Store install flow (Branch.io or similar, or manual UTM fallback for web).
- The code is short, readable, and case-insensitive (e.g. `GREIG7`), distinct from internal UUIDs.

### Attribution

- When a new user opens the app via a referral link, the `ref` code is captured and stored locally before sign-up begins.
- On sign-up completion, the code is resolved to a `referral_code_id` and written to the new consumer's profile as `referred_by_code_id`.
- Attribution is one-time and immutable — a member can only have one referrer.

### Reward trigger

- Reward fires when the referred friend's first payment clears — i.e. `consumer_memberships.status = 'active'` for the first time after a non-trial charge.
- Using Stripe webhook `invoice.payment_succeeded` with `billing_reason = 'subscription_create'` as the trigger.
- The reward is applied to the referrer's subscription, not the friend's.

### What counts as a qualifying referral

- Friend must complete sign-up with a paid plan (monthly or annual).
- Free trials alone do not trigger the reward — the webhook fires on the first real charge.
- Friend must remain active for a configurable grace period (e.g. 7 days) before the reward is marked `confirmed` — prevents same-day cancel gaming.

### Fraud prevention

- One referral reward per referred member (system enforces uniqueness on `invitee_profile_id`).
- Self-referral blocked: code resolves to a profile; if `profile_id = referrer_profile_id`, ignore silently.
- Rate limit: a referrer earns at most N confirmed rewards per rolling 30-day window (configurable — default 5). Beyond that, rewards queue for manual admin review rather than auto-applying.
- IP/device fingerprint logging at sign-up for admin audit trail (soft signal only, no auto-block).
- Referral rewards are only applied when the referrer's own membership is active at point of award.

### Reward: one month free

- Applied as a Stripe coupon or credit — see Stripe section below.
- Reward is per successful referral; no cap on lifetime rewards, but rate-limited per window.
- If the referred friend cancels or requests a refund within the grace period, the reward is voided (status → `cancelled`) and any applied credit is reversed where Stripe allows.

### Cooldowns

- No cooldown between individual referrals (one-per-referred-friend is the natural limit).
- Window cap (default 5/30 days) is the primary throttle.

---

## 2. Stripe Handling

### Options for "one month free"

| Approach | Pros | Cons |
|---|---|---|
| **Customer balance credit** | Simple API, no coupon required, applies to next invoice automatically | Balance is not subscription-specific; applies to any future charge on the customer |
| **Coupon / promotion code** | Explicit, auditable, flexible (% or fixed, duration) | Must be applied before the next billing cycle; applying to a running subscription requires `subscription.discount` update |
| **Invoice credit** | Direct, explicit | One-time, requires manual timing |

**Recommended:** Customer balance credit via `stripe.customers.createBalanceTransaction`. Set `amount` to the negative of the member's monthly plan price (fetch from `price.unit_amount`). The balance is consumed automatically on the next invoice.

For annual plans, credit the pro-rated monthly equivalent (annual price ÷ 12), not a full month, to avoid over-rewarding.

### Applying automatically from webhook

Webhook flow (`invoice.payment_succeeded`, `billing_reason = subscription_create`):

1. Receive event; extract `customer` and `subscription`.
2. Look up `consumer_memberships` by `stripe_subscription_id` to get `profile_id`.
3. Check if `profiles.referred_by_code_id` is set.
4. Resolve code → referrer `profile_id` → referrer `stripe_customer_id`.
5. Verify referrer membership is active; verify reward window not exceeded.
6. Insert `referral_rewards` row with status `pending`.
7. Apply Stripe customer balance credit to referrer.
8. After grace period passes (scheduled job), mark reward `confirmed`.
9. If friend cancels in grace period, void reward and reverse balance where possible.

All mutations are idempotent — keyed on `invitee_profile_id` to survive webhook retries.

---

## 3. Database Schema

### `referral_codes`

```sql
create table referral_codes (
  id           uuid primary key default gen_random_uuid(),
  profile_id   uuid not null references profiles(id) on delete cascade,
  code         text not null unique,              -- e.g. 'GREIG7'
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  unique(profile_id)                             -- one code per member
);
create index on referral_codes(code);
```

### `referral_invitations`

Tracks each attributed sign-up (one row per invited friend, regardless of whether they convert).

```sql
create table referral_invitations (
  id                   uuid primary key default gen_random_uuid(),
  referral_code_id     uuid not null references referral_codes(id),
  invitee_profile_id   uuid not null references profiles(id) on delete cascade,
  device_fingerprint   text,                     -- soft fraud signal
  attributed_at        timestamptz not null default now(),
  unique(invitee_profile_id)                     -- one referrer per invitee
);
```

### `referral_rewards`

```sql
create type referral_reward_status as enum (
  'pending',      -- grace period not elapsed
  'confirmed',    -- grace period passed, reward locked
  'applied',      -- Stripe credit applied
  'cancelled',    -- friend refunded/cancelled in grace period
  'voided',       -- manual admin void
  'review'        -- exceeded rate limit, pending admin review
);

create table referral_rewards (
  id                    uuid primary key default gen_random_uuid(),
  referral_invitation_id uuid not null references referral_invitations(id),
  referrer_profile_id   uuid not null references profiles(id),
  stripe_balance_txn_id text,                   -- Stripe balance transaction ID
  reward_amount_pence   integer not null,        -- amount credited (negative pence)
  status                referral_reward_status not null default 'pending',
  applied_at            timestamptz,
  confirmed_at          timestamptz,
  voided_at             timestamptz,
  void_reason           text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique(referral_invitation_id)                -- one reward per invitation
);
create index on referral_rewards(referrer_profile_id, status);
```

### Profile link

Add `referred_by_code_id` to `profiles`:

```sql
alter table profiles
  add column referred_by_code_id uuid references referral_codes(id) on delete set null;
```

Attribution must be written at the point of sign-up (before the first membership charge), using a service-role write to bypass RLS.

---

## 4. Mobile UX

### Account page — referral card

- Shown in the consumer account tab below membership status.
- Displays: referral code, "X friends joined", "X rewards earned", share button.
- Share button triggers native share sheet with the deep link and a pre-written message.
- Referral card only shown if membership is active (no active membership → no referral).

### Share invite link

- `betterofflocal.app/join?ref=<code>`
- iOS: universal link → opens app if installed, else web landing page.
- Android: App Link equivalent.
- Pre-written share message: "I've been saving money with Better Off Local — join with my link and support local businesses too."

### Referral status / rewards earned

- "Pending" state shown while grace period is active.
- "Confirmed" / credit message shown once reward is applied.
- Push notification sent when reward is confirmed: "Your friend joined! You've earned one month free."

---

## 5. Admin UX

### View referrals

- Table: referrer name/email, invited friend, invitation date, conversion date, reward status, Stripe transaction ID.
- Filterable by status (`pending`, `confirmed`, `voided`, `review`).

### Manually grant / revoke rewards

- Grant: create a `referral_rewards` row at `confirmed` and apply Stripe credit manually.
- Revoke: set status → `voided`, add `void_reason`, attempt Stripe balance reversal (negative → positive transaction).

### Fraud review queue

- Rewards that exceed the per-window cap land in a `review` queue.
- Admin approves or voids each one individually.
- Admin can flag a referrer for manual-approval mode (all future rewards go to review).

---

## 6. Implementation Plan

### Prerequisites

- Retailer offer management tested and stable (current in-progress work).
- Consumer membership flow stable end-to-end.

### Migrations (in order)

1. Add `referred_by_code_id` to `profiles`.
2. Create `referral_codes`.
3. Create `referral_invitations`.
4. Create `referral_rewards` (including enum).
5. Add RLS policies: members read own code/rewards; service role writes all.
6. Seed: auto-generate `referral_codes` rows for all existing active members (back-fill).

### Backend work

1. `generateReferralCode` RPC or server action — creates code lazily on first screen access.
2. `attributeReferral(code, inviteeProfileId)` — called post-sign-up, writes invitation row.
3. Stripe webhook handler extension — `invoice.payment_succeeded` with referral logic.
4. Grace-period job — cron or Supabase Edge Function, runs daily, confirms pending rewards older than grace period, voids cancelled ones.
5. Rate-limit check utility — count confirmed rewards for referrer in rolling 30 days.

### Flutter work

1. Capture `ref` query param from deep link at app open, persist to local storage.
2. On sign-up completion, call `attributeReferral`.
3. Referral card widget on account screen.
4. Native share sheet integration.
5. Push notification for confirmed reward.

### Admin portal work

1. `/admin/referrals` list page.
2. Grant/revoke modals.
3. Fraud review queue view.

### Open questions before building

- **Grace period duration** — 7 days is a starting point; check chargeback window.
- **Annual plan reward** — full month credit or pro-rated? Confirm with pricing.
- **Reward for referred friend** — do they also get a discount? (Not in scope above, could be added.)
- **Code format** — `GREIG7` style or longer? Must be unambiguous (no 0/O, 1/I/l).
- **Referral link landing page** — does a web landing page need to be built, or redirect to App Store?
- **Multi-region** — referral codes are region-agnostic for now; revisit when a second region launches.
