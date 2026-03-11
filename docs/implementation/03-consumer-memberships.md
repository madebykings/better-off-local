# 03 – Consumer Memberships

## Scope

This brief implements the full consumer membership system: Stripe billing
integration, server-side webhook sync, Flutter paywall flow, and membership
card screen. It builds on 02 – Profiles and Roles.

Consumer memberships are **not** granted client-side. The app reads membership
state from the server (Supabase `consumer_memberships` table protected by RLS).

---

## Out of Scope

- Native in-app purchase (IAP) — Stripe Checkout is used instead
- Retailer subscriptions (covered in brief 04)
- Redemption QR code (covered in brief 10) — a placeholder is shown
- Refund handling
- Deep link routing for Stripe return URL (noted as follow-up)

---

## Entitlement Rule

A consumer is entitled to redeem offers when:

```
status IN ('active', 'trialing') AND current_period_end > now()
```

This is enforced in:
- `Membership.isEntitled` (Flutter — guards UI only, not actual redemption)
- `consumer_membership_is_active(profile_id)` SQL function (server-side)
- `active_consumer_memberships` view (server-side)

---

## Supabase

### Migration: `022_membership_indexes.sql`

1. Unique partial index on `stripe_subscription_id` (where not null) — required
   to support webhook upserts targeting a specific subscription row.
2. Updated `consumer_membership_is_active()` to accept both `'active'` and
   `'trialing'` statuses.
3. Updated `active_consumer_memberships` view to match the same rule.

The `consumer_memberships` table itself was created in `006_consumer_memberships.sql`.

---

## Supabase Edge Functions

### `create-checkout-session`

Called by the Flutter app (with user JWT) to create a Stripe Checkout Session.

Flow:
1. Verify JWT — reject if no session.
2. Validate `plan` param (`monthly` | `annual`).
3. Look up existing `stripe_customer_id` from `consumer_memberships` (via service role).
4. Create Stripe customer if none exists (email + `supabase_user_id` metadata).
5. Create Stripe Checkout Session with the appropriate price ID.
6. Return `{ url: session.url }`.

Required env vars:
- `STRIPE_SECRET_KEY`
- `STRIPE_PRICE_ID_MONTHLY`
- `STRIPE_PRICE_ID_ANNUAL`
- `APP_SCHEME` (deep link scheme, e.g. `betterofflocal`)
- `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`

### `stripe-webhook`

Receives Stripe webhook events and syncs `consumer_memberships`.

Handled events:

| Event | Action |
|-------|--------|
| `invoice.paid` | Upsert membership row: status=`active`, update period dates |
| `invoice.payment_failed` | Update status to `past_due` |
| `customer.subscription.deleted` | Update status to `cancelled`, set `ended_at` |

All upserts use `stripe_subscription_id` as the conflict key (requires
migration 022 unique index).

The `supabase_user_id` is read from `subscription.metadata` — set when the
checkout session is created.

Required env vars:
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET` (from Stripe dashboard webhook endpoint)
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`

---

## Flutter

### Domain: `membership.dart`

Rewrote to align with DB schema:
- `MembershipStatus` enum: `inactive`, `trialing`, `active`, `pastDue`, `cancelled`, `expired`
- `MembershipPlanInterval` enum: `monthly`, `annual`
- `Membership.isEntitled` — matches server entitlement rule (status + period end)
- `Membership.fromMap` — deserialises full DB row

### Data layer

`MembershipRemoteDataSource`:
- `fetchMembership(userId)` — queries `consumer_memberships` by `profile_id`, most recent first
- `createCheckoutSession(plan)` — calls the `create-checkout-session` edge function

`MembershipRepositoryImpl` — delegates to data source.

### Providers

`currentMembershipProvider` (`FutureProvider<Membership?>`) now watches
`sessionProvider` so it re-fetches on auth state change.

### Controller: `MembershipController`

State: `MembershipIdle | MembershipLoading | MembershipCheckoutReady(url) | MembershipControllerError`

Methods:
- `startCheckout(plan)` — calls edge function, emits `MembershipCheckoutReady`
- `refreshMembership()` — invalidates `currentMembershipProvider`
- `reset()` — resets to idle (called after URL launch)

### PaywallScreen

- Plan selector: Annual (£49.99/yr, best value badge) and Monthly (£5.99/mo)
- Annual selected by default
- Benefits list
- Subscribe button → `startCheckout` → listener launches URL via `url_launcher`
- Handles `MembershipCheckoutReady` (launch URL) and `MembershipControllerError` (SnackBar)

### MembershipCardScreen

- If `isEntitled == false`: shows paywall prompt with link to `/paywall`
- If entitled: shows membership card with gradient, member name (from profile),
  plan label, status badge, renewal date, cancel-at-period-end notice
- QR placeholder — labelled "coming soon", replaced in brief 10
- Pull-to-refresh calls `refreshMembership()`

### SubscriptionSuccessScreen

- Shown after returning from Stripe Checkout (deep link: `betterofflocal://subscription-success`)
- On init: invalidates `currentMembershipProvider` to re-fetch from server
- CTA: "Start exploring" → home; "View my membership card" → card

### pubspec changes

Added `url_launcher: ^6.3.0` for launching Stripe Checkout in the browser.

### Route changes

`route_names.dart`:
- Added `subscriptionSuccess = '/subscription-success'`

`app_router.dart`:
- Added `SubscriptionSuccessScreen` import and route under membership gating section

---

## File Checklist

### Created
- `supabase/migrations/022_membership_indexes.sql`
- `supabase/functions/stripe-webhook/index.ts`
- `supabase/functions/create-checkout-session/index.ts`
- `docs/implementation/03-consumer-memberships.md` (this file)

### Modified
- `apps/mobile/pubspec.yaml` — added `url_launcher`
- `apps/mobile/lib/features/memberships/domain/membership.dart` — rewritten
- `apps/mobile/lib/features/memberships/domain/membership_repository.dart` — updated interface
- `apps/mobile/lib/features/memberships/data/membership_remote_data_source.dart` — implemented
- `apps/mobile/lib/features/memberships/data/membership_repository_impl.dart` — implemented
- `apps/mobile/lib/features/memberships/providers/membership_providers.dart` — watches session
- `apps/mobile/lib/features/memberships/presentation/membership_controller.dart` — implemented
- `apps/mobile/lib/features/memberships/presentation/paywall_screen.dart` — implemented
- `apps/mobile/lib/features/memberships/presentation/membership_card_screen.dart` — implemented
- `apps/mobile/lib/features/memberships/presentation/subscription_success_screen.dart` — implemented
- `apps/mobile/lib/app/router/route_names.dart` — added `subscriptionSuccess`
- `apps/mobile/lib/app/router/app_router.dart` — added import + route

---

## Assumptions

- Stripe Checkout hosted page is used — no native IAP. This keeps PCI compliance
  simple but requires an external browser launch.
- Display prices (£5.99/mo, £49.99/yr) are hardcoded in the UI for now.
  Actual billing amounts are controlled by Stripe price objects.
- `supabase_user_id` is stored in Stripe subscription metadata at checkout
  session creation time. The webhook handler relies on this.
- The `APP_SCHEME` env var must match the iOS/Android deep link configuration
  for the Stripe return redirect to work.

## Risks and Follow-ups

- **Deep link handling**: iOS and Android platform config (Info.plist,
  AndroidManifest.xml) must register the `betterofflocal://` scheme for
  Stripe return redirects to route to the app. This is a platform-config task.
- **Webhook timing**: `SubscriptionSuccessScreen` refreshes on mount, but
  the webhook may not have fired yet. Membership card shows a "pull to refresh"
  hint. A Supabase Realtime subscription is a future improvement.
- **Duplicate memberships**: a user re-subscribing after cancellation creates a
  new `consumer_memberships` row. `fetchMembership` returns the most recent
  row by `created_at`. Review when cancellation/resubscription flows are tested.
- **Stripe customer re-use**: if a user has no `stripe_customer_id` in DB
  but previously subscribed (e.g. row was deleted), a duplicate Stripe customer
  will be created. Add a lookup-by-email fallback as a follow-up.
