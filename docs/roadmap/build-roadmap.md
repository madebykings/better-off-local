# Better Off Local – Build Roadmap

## Platform Positioning

Better Off Local is a **membership verification platform**.

Consumers pay for membership. That membership unlocks benefits at participating local
businesses. The platform's job is to prove — cryptographically and server-side — that a
given person is an active member, and to relay that proof to a business so the business
can apply a benefit.

No discount codes are ever exposed. No client-side trust is ever granted. Every
entitlement check happens on the server.

This applies equally to:
- in-store redemption (consumer shows QR, retailer scans it)
- online redemption (website shows QR, consumer scans it with app)

The experience should feel like presenting a membership card at an exclusive club, not
clipping a coupon.

---

## Phase A — Verification Platform Foundation

Everything in this phase is backend, data layer, and architecture. No new UI.

### A1 — Critical Bug Fixes
- [x] Fix race condition in `validate_redemption.ts` — atomic token consumption using
      `UPDATE ... WHERE consumed_at IS NULL RETURNING id` as the true gate
- [x] Fix `consumer_membership_is_active()` SQL function — must include `trialing`
      status to match application-layer checks (migration 028)

### A2 — Retailer Billing Sync Gap
- [ ] Extend `stripe-webhook` edge function to handle retailer subscription events:
      `invoice.paid`, `invoice.payment_failed`, `customer.subscription.deleted`
      → sync `retailer_subscriptions` table (mirrors consumer membership logic)

### A3 — Online Redemption Architecture
- [x] Document online redemption flow (`docs/architecture/online-redemption.md`)
- [x] Document universal JavaScript widget (`docs/architecture/universal-widget.md`)
- [x] Document WooCommerce connector (`docs/architecture/woocommerce-connector.md`)
- [x] Create `verification_sessions` table and RLS (migration 027)
- [ ] Implement `create-verification-session` edge function
- [ ] Implement `approve-verification-session` edge function (called when consumer scans)
- [ ] Implement `poll-verification-session` edge function (called by widget)

### A4 — Data Layer: Portals
- [ ] Build `lib/queries/` in retailer portal — server-side read functions for all pages
- [ ] Build `lib/queries/` in admin portal — server-side read functions for all pages
- [ ] Build `lib/mappers/` in both portals — raw DB row → view model
- [ ] Build `packages/types/src/index.ts` — canonical shared TypeScript types

### A5 — Data Layer: Discovery
- [ ] Implement nearby/distance query — haversine function or PostGIS activation
- [ ] Add spatial index on `retailer_locations(latitude, longitude)`
- [ ] Ensure `public_live_offers` view handles `start_at`/`end_at` correctly (already done
      in migration 019, verify in practice)

### A6 — Audit Events
- [ ] Wire `audit_events` inserts into redemption flow (token creation, validation outcome)
- [ ] Wire `audit_events` inserts into admin moderation actions

---

## Phase B — Consumer App (real screens)

Wire real data into Flutter screens. Architecture and data layer from Phase A must be
complete first.

- [ ] Home screen — real nearby offers + featured retailers data
- [ ] Offer list screen — live data, category filter
- [ ] Offer detail screen — full data, membership-gated redeem CTA
- [ ] Retailer detail screen — real profile + offer list
- [ ] Map screen — Google Maps, location permission, offer pins, haversine sort
- [ ] Favourites screen — toggle + persistent list
- [ ] Membership card screen — real QR from `create-redemption-token`
- [ ] Redemption flow — QR display, countdown, confirm/fail screens
- [ ] Notifications screen — list from DB, mark read
- [ ] Account screen — real profile, membership status, savings summary
- [ ] Settings screen — legal links, permission info, sign out
- [ ] App assets — fonts, app icon, splash screen, asset bundle

---

## Phase C — Portal Screens (real)

Wire real data into Next.js portal pages.

### Retailer Portal
- [ ] Dashboard — real metrics (live offers, redemptions, views, saves)
- [ ] Offer list — real data with status filter
- [ ] Create/edit offer — form components with validation
- [ ] Locations — create/edit form with address fields
- [ ] Scan page — browser QR scanner wired to `validate_redemption` server action
- [ ] Redemption history — real table with filters
- [ ] Billing — real subscription status from Supabase

### Admin Portal
- [ ] Dashboard — real platform metrics
- [ ] Retailer queue — pending approvals table with approve/reject actions
- [ ] Offer queue — pending offers table with approve/reject actions
- [ ] Retailers management — search, status, moderation actions
- [ ] Offers management — search, status, moderation actions
- [ ] Members lookup — member search, membership state, redemption history
- [ ] Redemptions monitoring — suspicious activity, filters
- [ ] Categories management — CRUD with sort order
- [ ] Subscriptions — consumer and retailer billing state
- [ ] Audit log — admin actions and system events

---

## Phase D — Online Redemption (WooCommerce + Widget)

Implement the verification session redemption path. Architecture documented in Phase A.

- [ ] `create-verification-session` edge function — creates session, returns session QR data
- [ ] `approve-verification-session` edge function — consumer app scans, calls this to
      approve session
- [ ] `poll-verification-session` edge function — widget polls until approved/expired
- [ ] Consumer app: "Scan Online Checkout" flow — scan website QR, call approve function,
      show confirmation
- [ ] Universal JavaScript widget — `widget.js` CDN-hosted script:
      - creates session on load
      - renders QR
      - polls for approval
      - fires approval callback
      - never exposes a discount code
- [ ] WooCommerce connector — WordPress plugin:
      - installs widget
      - listens for approval webhook
      - applies discount server-side via WooCommerce hook
      - no coupon code visible to consumer
- [ ] Webhook: BOL backend → connector on session approval

---

## Phase E — Launch Hardening and Release

- [ ] CI/CD — GitHub Actions: Flutter build, Next.js deploy, migration run
- [ ] App signing — iOS provisioning profile + Android keystore
- [ ] Push notifications — FCM/APNs integration + server-side dispatch
- [ ] Crash reporting — Firebase Crashlytics or Sentry in Flutter
- [ ] Environment separation — local / staging / production verified clean
- [ ] RLS audit — verify all policies with real session types
- [ ] Performance — query plan review, index audit
- [ ] Legal pages — Privacy Policy + Terms URLs wired in settings screen
- [ ] Store metadata — app description, screenshots, keywords
- [ ] TestFlight + Play internal testing track
- [ ] Production Supabase project — migrations applied, backups configured
- [ ] Monitoring and alerting baseline
