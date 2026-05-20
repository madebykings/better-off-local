# Better Off Local — MVP Roadmap

Last updated: 2026-05-20

This document maps the full gap between the current codebase state and a production-ready MVP launch. It supersedes the high-level task lists in `docs/roadmap/build-roadmap.md`.

---

## Current State Summary

### What exists and is functional
- **Database schema** — 16 tables, migrations 001–027 applied, RLS policies in place
- **Supabase edge functions** — `create-checkout-session` (consumer) and `create-redemption-token` both real and complete; `stripe-webhook` handles consumer subscription lifecycle
- **Flutter app structure** — all feature layers scaffolded (domain/data/presentation) with Riverpod providers and go_router navigation
- **Retailer portal** — onboarding layout shell + step scaffolding (step 1 business-details UI implemented; server action is a stub); auth guards; route groups
- **Admin portal** — all routes and page stubs exist, no real logic
- **Online redemption** — Flutter UI complete (scan screen, states, animations); repository and data source scaffolded as stubs
- **Consumer membership** — Flutter paywall and membership card screens exist; Stripe checkout session creation is real
- **Membership pass token** — `create-membership-pass-token` and `validate-qr-token` (unified scanner backend) edge functions implemented; `membership_pass_tokens` migration ready (028); Flutter `requestPassToken` wired (branch: feature/membership-pass-token-edge-function, not yet merged)

### What is incomplete or stubbed
- All retailer portal onboarding server actions (nothing actually persists to the database)
- Retailer portal steps 2–9 (branding, categories, location, hours, links, offers, preview, subscription)
- Admin portal moderation actions (approve, reject, suspend retailers and offers)
- Flutter screens wired to live data (home, discovery, offer detail, retailer detail, favourites, membership card pass QR)
- Online redemption edge functions (`create-verification-session`, `approve-verification-session`, `poll-verification-session`)
- Membership pass token edge function (`create-membership-pass-token`) for wallet pass / QR display
- Retailer Stripe subscription (checkout + webhook events)
- Retailer portal dashboard (live data), offers management (create/edit/delete)
- Retailer portal in-store scanner (validates redemption tokens)
- Push notifications infrastructure
- `packages/types`, `packages/ui`, `packages/config` — all empty stubs
- Seed data, environment separation, crash reporting, app store assets

---

## Phase 1 — MVP Launch Blockers

These items must be complete before any real consumer or retailer can use the product.

---

### 1.1 Auth Foundation (all platforms)

**Description:** Working sign-in, sign-up, and password reset across the Flutter app and both portals. Session-based route guards. Admin role guard via `app_metadata.role`.

**Dependencies:** None — no schema beyond Supabase Auth required.

**Complexity:** Low

**Backend:** None (Supabase Auth as-is). Set `app_metadata.role = 'admin'` on admin accounts via Supabase dashboard.

**Flutter:** Wire `SignInScreen`, `SignUpScreen`, `ForgotPasswordScreen` to `AuthController`; fix `appRouterProvider` `refreshListenable` for session-reactive redirects; improve `AuthException` → user-friendly error messages.

**Retailer portal:** Connect `sign_in_form.tsx` to `lib/actions/auth.ts` server action; wire forgot-password page; implement `requireRetailerUser` auth guard properly.

**Admin portal:** Connect `sign_in_form.tsx` to `lib/actions/auth.ts`; implement `requireAdmin` with `app_metadata.role` check.

**Stripe:** None.

---

### 1.2 Consumer Membership Purchase

**Description:** A consumer can sign up, reach the paywall, purchase a monthly or annual membership, and have their `consumer_memberships` row activated. Membership state drives all gated features.

**Dependencies:** 1.1 (auth). `create-checkout-session` and `stripe-webhook` edge functions are already real.

**Complexity:** Medium

**Backend:** Verify `stripe-webhook` correctly upserts `consumer_memberships` on `invoice.paid`. Confirm deep link scheme (`betterofflocal://subscription-success`) is configured in Flutter. Verify `invoice.payment_failed` and `customer.subscription.deleted` handle deactivation.

**Flutter:** Wire `PaywallScreen` to call `create-checkout-session`, open the returned URL in browser, handle the deep link back to the app; wire `membershipProvider` to query `consumer_memberships` with `status = 'active'`; update membership card screen to reflect live state.

**Retailer portal:** None.

**Admin portal:** None.

**Stripe:** Create consumer subscription products and prices (£2.99/month, annual option) in Stripe dashboard. Configure webhook endpoint in Stripe for `invoice.paid`, `invoice.payment_failed`, `customer.subscription.deleted`.

---

### 1.3 Retailer Onboarding — Complete Flow

**Description:** A retailer can complete all onboarding steps and submit their listing for admin review. All data persists to Supabase. The flow covers business details, branding, categories, location, opening hours, links, first offer, and preview.

**Dependencies:** 1.1 (auth). Requires Supabase Storage bucket for logo/cover images.

**Complexity:** High

**Backend:**
- Create `retailer_users` table row linking `auth.users` to `retailers` on first step save
- Implement `saveBusinessDetails` server action: Zod validation + upsert `retailers` row (name, tagline, description, business_type, phone) + advance `onboarding_step`
- Implement branding step: upload logo and cover image to Supabase Storage, store public URLs in `retailers`
- Implement categories step: upsert `retailer_categories` rows
- Implement location step: upsert `retailer_locations` row (address, postcode, lat/lng via Google Maps Geocoding or manual entry)
- Implement hours step: store in a `retailer_hours` JSONB column (or separate table if preferred)
- Implement links step: update `retailers.website_url`, social link fields
- Implement first offer step: insert `offers` row with `status = 'draft'`
- Implement submit step: set `retailers.status = 'pending_review'`, send email notification to admin

**Retailer portal:**
- Step 2 (Branding): logo and cover image upload with preview using Supabase Storage client
- Step 3 (Categories): multi-select from `categories` table
- Step 4 (Location): address form with postcode lookup or map pin
- Step 5 (Opening hours): day-by-day open/close time pickers
- Step 6 (Links): website and social media URL inputs
- Step 7 (First offer): title, description, offer type, value, dates
- Step 8 (Preview): read-only summary of all entered data before submission
- Step 9 (Subscription): redirect to Stripe checkout after admin approval (not during onboarding)
- Resume from persisted `onboarding_step` on page load (replace redirect-to-first-step stub)

**Admin portal:** None (admin review is 1.5 below).

**Stripe:** None at this stage (subscription comes after approval per business rule).

---

### 1.4 In-Store Offer Redemption — Consumer QR Flow

**Description:** A consumer with an active membership selects a specific offer, sees its live availability state (eligible / rule blocked / already used), taps Redeem, and receives a short-lived offer-specific QR. The retailer scans it once. The backend validates everything in a single call and the retailer sees one clear result: approved (with benefit to apply) or rejected (with reason).

This is the **primary discount redemption flow**. The membership Card tab QR is a separate, general membership proof mechanism — it is not used to redeem specific offers.

**Dependencies:** 1.2 (active membership), 1.8 (live offers in DB), `create-redemption-token` edge function (already implemented).

**Complexity:** Medium

**Backend:**
- `create-redemption-token` already implemented and validates membership + offer rules at token creation
- `validate-qr-token` unified edge function: implemented (feature/membership-pass-token-edge-function); handles both offer redemption and membership pass tokens; auto-detects type from hash; marks offer tokens consumed atomically; re-validates membership and offer rules at scan time; records redemption
- Need to confirm `validate-qr-token` returns `benefit_description` (offer value text) for retailer display
- Redemption recording in `redemptions` table is triggered from within `validate-qr-token` (offer path)

**Flutter:**
- Wire offer detail screen to show live availability state before the Redeem CTA: eligible, per-user/per-day cap hit (+ next available time), offer expired, no membership
- Membership gate on Redeem CTA: active membership → call `create-redemption-token`; no membership → push to paywall
- `RedemptionQRScreen` already exists; wire it to display returned token, expiry countdown, allow refresh

**Retailer portal:** Scanner is 1.7 below.

**Admin portal:** None.

**Stripe:** None.

---

### 1.4a Membership Pass QR (general identity proof — Card tab)

**Description:** The Card tab displays a short-lived membership-level QR that proves active BOL membership without being tied to any offer. Used for general verification only — not for discount redemption.

**Dependencies:** 1.2 (active membership). Backend implemented (feature/membership-pass-token-edge-function).

**Complexity:** Low (backend done; Flutter wiring already scaffolded)

**Backend:** `create-membership-pass-token` and `validate-qr-token` (membership pass path) are implemented. Migration 028 (`membership_pass_tokens` table) is ready.

**Flutter:** `requestPassToken()` stub is already wired to the real edge function call. `PassQRController` auto-refresh and countdown UI already complete. No further Flutter work required once migration 028 is applied.

**Retailer portal:** Handled by unified scanner (1.7). No separate membership-only scanner mode.

**Admin portal:** None.

**Stripe:** None.

---

### 1.5 Admin Moderation Workflow

**Description:** An admin can view pending retailers, review their submission details, and approve or reject them. Approved retailers become publicly visible. Rejected retailers receive feedback.

**Dependencies:** 1.1 (admin auth), 1.3 (retailers submitting for review).

**Complexity:** Medium

**Backend:**
- Server action: `approveRetailer(retailerId)` — set `retailers.status = 'approved'`, `retailers.is_active = true`; trigger email notification to retailer
- Server action: `rejectRetailer(retailerId, reason)` — set `retailers.status = 'rejected'`; trigger email notification with reason
- Server action: `suspendRetailer(retailerId, reason)` — set `retailers.status = 'suspended'`, `retailers.is_active = false`
- Server action: `approveOffer(offerId)` — set `offers.status = 'live'`
- Server action: `rejectOffer(offerId, reason)` — set `offers.status = 'rejected'`
- Log all actions to `admin_actions` table

**Flutter:** None.

**Retailer portal:** None (retailer receives email; their status is visible in dashboard).

**Admin portal:**
- `/retailers` page: table of pending/approved/rejected/suspended retailers with status badges and action buttons
- `/retailers/[id]` page: full retailer detail view (submitted data, branding, location, offers) with Approve / Reject / Suspend controls
- `/offers` page: table of offers pending review with Approve / Reject controls
- Loading, empty, and error states on all pages

**Stripe:** None.

---

### 1.6 Retailer Subscription (post-approval billing)

**Description:** After admin approval, a retailer receives an email with a link to pay and activate their subscription (£79.99/year). On successful payment their account becomes fully active and their listing goes live.

**Dependencies:** 1.5 (admin approval). Requires new retailer-specific Stripe checkout flow.

**Complexity:** Medium

**Backend:**
- New edge function `create-retailer-checkout-session`: auth check → look up retailer by `retailer_users.user_id` → create/retrieve Stripe customer → create Checkout Session with the retailer annual price → return URL
- Extend `stripe-webhook` to handle `invoice.paid` for retailer subscriptions: upsert `retailer_subscriptions` row with `status = 'active'`, set `retailers.is_active = true`
- Handle `customer.subscription.deleted` for retailers: set `retailer_subscriptions.status = 'cancelled'`, set `retailers.is_active = false`
- Handle `invoice.payment_failed` for retailers: set `retailer_subscriptions.status = 'past_due'`

**Flutter:** None.

**Retailer portal:**
- Subscription step (step 9 in onboarding): show "You've been approved" message; button calls `create-retailer-checkout-session` and opens returned URL; handle redirect back from Stripe; show active subscription state on dashboard

**Admin portal:** None.

**Stripe:** Create retailer subscription product and price (£79.99/year). Configure webhook endpoint to also receive retailer subscription events.

---

### 1.7 In-Store Redemption — Retailer Scanner (Unified)

**Description:** A retailer opens a camera scanner in the portal and scans any BOL QR code. The backend auto-detects whether it is an offer redemption token or a membership pass token and returns the appropriate result. No mode selection or staff configuration required — one scanner handles all QR types.

**Dependencies:** 1.4 (consumer offer QR), 1.4a (membership pass QR). `validate-qr-token` edge function already implemented.

**Complexity:** Medium

**Backend:** `validate-qr-token` is fully implemented (feature/membership-pass-token-edge-function). Both paths complete:
- ✅ Retailer ownership check (`redemptionToken.retailer_id === caller's retailer_id`)
- ✅ Token expiry and consumed_at checks
- ✅ Consumer membership re-verified at scan time
- ✅ Offer live status and date window re-checked at scan time
- ✅ Offer rules re-validated at scan time: per-user, per-day, global cap, cooldown, valid days, valid time window
- ✅ Atomic token consume (`UPDATE WHERE consumed_at IS NULL` + race detection via `.select()`)
- ✅ `redemptions` row inserted on success; rejected attempts logged for audit
- ✅ Structured result: `offer_title`, `benefit_text`, `next_available_at` for cap-based rejections
- ⚠️ **Launch blocker:** token consume and redemption insert are two separate operations. If the insert fails after a successful consume, the token is permanently consumed with no record and the scan returns `server_error`. Must be wrapped in a single `redeem_offer_token(token_hash, retailer_user_id)` Postgres RPC transaction before production launch.

**Flutter:** None.

**Retailer portal:**
- `/scan` page: camera scanner (`react-webcam` + `jsQR` or equivalent) or manual token entry fallback
- On scan: send raw token to `validate-qr-token` server action; no need to specify token type
- **Approved — offer:** show offer title, benefit to apply (e.g. "10% off total bill"), member plan tier
- **Approved — membership pass:** show "Active BOL Member", plan interval, member since date
- **Rejected:** show clear reason per error code — expired, already used, membership invalid, rule blocked (+ next available time for cap-based blocks), offer not valid for this retailer
- Handle camera permission denied gracefully

**Admin portal:** None.

**Stripe:** None.

---

### 1.8 Offer Management (Retailer Portal)

**Description:** A retailer can create, edit, pause, and delete offers from their dashboard. Offers go to pending review before going live (first offer via onboarding; subsequent offers via dedicated offers section).

**Dependencies:** 1.1 (auth), 1.3 (retailer exists in DB).

**Complexity:** Medium

**Backend:**
- Server actions: `createOffer`, `updateOffer`, `deleteOffer`, `pauseOffer`
- New offers default to `status = 'pending_review'`; admin approves to `live` (see 1.5)
- Validate offer rules fields (one per user, one per day, caps, date windows)

**Flutter:** None.

**Retailer portal:**
- `/offers` page: table of all offers with status badges, views/saves/redemptions stats
- `/offers/new` page: offer creation form (title, description, type, value text, terms, dates, redemption rules)
- `/offers/[id]/edit` page: same form pre-populated
- `/dashboard` page: 4 metric cards (live offers, total redemptions, total views, total saves) + recent redemptions table — all wired to live data

**Admin portal:** Covered by 1.5.

**Stripe:** None.

---

### 1.9 Consumer Discovery (Flutter)

**Description:** Consumers can browse live offers on the home screen and explore page, filter by category, view offer details, and see retailer profiles. All screens are wired to live Supabase data.

**Dependencies:** 1.1 (auth), 1.5 and 1.6 (approved live retailers with live offers).

**Complexity:** Medium

**Backend:** No new edge functions. All queries use existing tables via Supabase client with RLS.

**Flutter:**
- Wire `homeOffersProvider`, `liveOffersProvider`, `categoriesProvider` to real data sources
- Implement `OffersRemoteDataSource` fetch methods (live offers, category filter, offer detail, retailer offers, offer view logging)
- Implement `RetailersRemoteDataSource` (single retailer, live retailers list)
- Wire `OfferListScreen`, `OfferDetailScreen`, `RetailerDetailScreen` to providers
- Wire `NearbyOffersSection`, `FeaturedRetailersSection`, `CategoriesSection` on home screen
- Membership-gated redeem CTA: active membership → trigger redemption flow; no membership → push to paywall

**Retailer portal:** None.

**Admin portal:** None.

**Stripe:** None.

---

### 1.10 Favourites and Redemption History (Flutter)

**Description:** Consumers can save and unsave offers and retailers. They can view their redemption history. The home screen shows a savings summary.

**Dependencies:** 1.9 (discovery screens wired).

**Complexity:** Low

**Backend:** No new edge functions. Queries `favourites` and `redemptions` tables.

**Flutter:**
- Implement `FavouritesRemoteDataSource` (fetch, add, remove for offers and retailers)
- Wire `FavouritesScreen` tabs (Offers, Retailers)
- Add favourite toggle to `OfferDetailScreen` and `RetailerDetailScreen`
- Wire `redemptionHistoryProvider` and `SavingsSummaryCard` on home screen

**Retailer portal:** None.

**Admin portal:** None.

**Stripe:** None.

---

### 1.11 Online Redemption — Edge Functions

**Description:** A consumer can scan a QR code on a retailer's checkout page to approve a discount automatically. Requires three edge functions not yet implemented.

**Dependencies:** 1.2 (active membership), online redemption Flutter UI already complete.

**Complexity:** High

**Backend:**
- `create-verification-session` edge function: auth check → membership active → generate short-lived session token → insert into `verification_sessions` with `status = 'pending'` and TTL → return token for QR display on retailer's website
- `approve-verification-session` edge function: consumer calls with token → atomic UPDATE WHERE `status = 'pending'` → set `status = 'approved'` + store retailer/offer context → return retailer name, logo URL, offer title for success display
- `poll-verification-session` edge function: retailer's website polls with session ID → return current `status` → on `approved`, complete checkout flow on retailer side
- RLS: consumer can only update their own session; retailer read access for poll endpoint

**Flutter:** Wire `OnlineRedemptionRemoteDataSource.approveSession()` to the real `approve-verification-session` edge function (replaces `UnimplementedError` stub).

**Retailer portal / website:** Documentation and JS snippet for retailers to embed the QR trigger on their checkout page (post-MVP scope but edge functions must exist for MVP).

**Admin portal:** None.

**Stripe:** None.

---

### 1.12 Seed Data and Environment Configuration

**Description:** Local and staging environments have enough seed data to test every flow. Environment variables are clearly separated across local, staging, and production. Secrets are never committed.

**Dependencies:** All above items.

**Complexity:** Low

**Backend:**
- SQL seed file: categories (9 business types), 1 sample retailer, 1 sample location, 2 sample offers, 1 sample admin user note
- `.env.local.example` files for all apps documenting required vars
- Confirm separate Supabase projects for dev/staging/production
- Confirm Stripe webhook endpoints registered for all environments (test mode for dev/staging, live for prod)

**Flutter:** `lib/config/app_config.dart` with environment-aware Supabase URL and anon key selection.

**Retailer portal / Admin portal:** `.env.local.example` files.

**Stripe:** Webhook endpoints for staging and production environments.

---

## Phase 2 — Important Enhancements

These items significantly improve the product but are not required for initial launch.

---

### 2.1 Push Notifications

**Description:** Consumers receive push notifications for new nearby offers, account events (membership renewal, expiry), and redemption confirmations.

**Dependencies:** Phase 1 complete.

**Complexity:** Medium

**Backend:** Edge function triggered by DB webhooks or scheduled job to send FCM/APNs notifications. Store FCM tokens in `profiles`. Insert notification rows into `notifications` table.

**Flutter:** Request notification permission on app start; handle foreground and background push payloads; wire `NotificationsScreen` to query `notifications` table.

**Retailer portal:** None.

**Admin portal:** Ability to broadcast notifications to all members (post-launch marketing tool).

**Stripe:** None.

---

### 2.2 Retailer Portal — Account and Subscription Management

**Description:** A retailer can view their active subscription, billing history, and update payment method. They can manage business profile edits post-onboarding.

**Dependencies:** 1.6 (subscription).

**Complexity:** Medium

**Backend:** Stripe Customer Portal session creation edge function; server actions for updating retailer profile fields post-onboarding.

**Retailer portal:**
- `/settings` page: business profile editing (name, description, phone, website, hours)
- `/billing` page: subscription status, renewal date, link to Stripe Customer Portal for payment method update and invoice history

**Admin portal:** None.

**Stripe:** Enable Stripe Customer Portal for the account.

---

### 2.3 Google Maps Integration (Consumer Discovery)

**Description:** Consumers can view a map of nearby retailers and offers. Distance sorting uses real device location.

**Dependencies:** 1.9 (discovery screens).

**Complexity:** Medium

**Backend:** None (queries already include lat/lng).

**Flutter:** Implement `MapScreen` using Google Maps Flutter plugin; request location permission on first use; show retailer pins; tap to navigate to `RetailerDetailScreen`; replace Haversine distance calculation with live device location.

**Retailer portal:** None.

**Admin portal:** None.

**Stripe:** None.

---

### 2.4 Shared Component Library (packages/ui)

**Description:** Move shared UI primitives (Button, Card, Badge, Input) into `packages/ui` for use by both portals. Reduces duplication and enforces design consistency.

**Dependencies:** Both portals in use.

**Complexity:** Low

**Backend:** None.

**Retailer portal / Admin portal:** Refactor to import from `packages/ui`. Update Turborepo pipeline.

**Stripe:** None.

---

### 2.5 Admin Analytics Dashboard

**Description:** Admins can see platform-wide metrics: total members, active retailers, offers live, redemptions this month, revenue trends.

**Dependencies:** Phase 1 complete.

**Complexity:** Medium

**Backend:** Aggregate queries; possibly a Supabase view for performance.

**Admin portal:** `/` dashboard page wired to real metrics.

**Stripe:** Read Stripe dashboard data via API for revenue figures, or derive from `retailer_subscriptions` / `consumer_memberships` tables.

---

### 2.6 Retailer Moderation — Offer Review Queue

**Description:** New and edited offers are queued for admin review before going live, with clear accept/reject flow and retailer notification.

**Dependencies:** 1.5, 1.8.

**Complexity:** Low

**Backend:** Already planned in 1.5. This item covers edge cases: bulk approve, filtering by retailer, review history.

**Admin portal:** Enhanced offers review page with bulk actions and filters.

---

### 2.7 Error Handling and Loading States (Launch Hardening)

**Description:** All screens across all platforms have proper loading, empty, and error states. No blank white screens, no raw backend errors, no dead-end flows. Camera and location permission denials are handled gracefully.

**Dependencies:** All Phase 1 features implemented.

**Complexity:** Medium

**All platforms:** Systematic audit and implementation per brief 08 scope.

---

## Phase 3 — Future Platform Expansion

These items are explicitly post-launch and should not influence MVP architecture decisions.

---

### 3.1 Multiple Regions

**Description:** Expand beyond Clackmannanshire to other Scottish towns and eventually UK-wide. Requires region-based offer filtering and region-scoped memberships or national membership options.

**Dependencies:** Launch and validated product-market fit.

**Complexity:** High

**Notes:** Schema already has `town`/`postcode` on retailer locations; no region table yet. Consumer memberships are not currently region-scoped. This will require a data model extension.

---

### 3.2 Consumer Referral Programme

**Description:** Existing consumers can refer friends; both parties receive a discount or free period on membership.

**Dependencies:** Phase 2 complete.

**Complexity:** Medium

**Backend:** New `referrals` table; Stripe coupon creation; referral code generation and lookup.

---

### 3.3 Retailer Loyalty Points

**Description:** Retailers can configure loyalty point accrual per redemption. Consumers accumulate and redeem points within a retailer.

**Dependencies:** Phase 2 complete.

**Complexity:** High

**Notes:** Explicitly excluded from MVP per brief 05.

---

### 3.4 Social Sign-In (OAuth)

**Description:** Consumers can sign in with Apple or Google instead of email/password.

**Dependencies:** Phase 1 auth.

**Complexity:** Low–Medium

**Notes:** Supabase supports this natively; main effort is iOS/Android OAuth app registration and deep link configuration.

---

### 3.5 Advanced Recommendation Engine

**Description:** Personalised offer recommendations based on redemption history, favourites, and location behaviour.

**Dependencies:** Sufficient usage data.

**Complexity:** High

---

### 3.6 Digital Wallet Pass (Apple Wallet / Google Wallet)

**Description:** Consumer can add their membership as an Apple Wallet or Google Wallet pass with QR code embedded.

**Dependencies:** 1.4 (pass token infrastructure).

**Complexity:** Medium

**Notes:** Requires signing certificates (Apple) and Google Pay API. The token infrastructure in `create-membership-pass-token` is the same foundation.

---

### 3.7 Crash Reporting and App Analytics

**Description:** Integrate Firebase Crashlytics (or Sentry) for crash reporting and basic event analytics for funnel tracking.

**Dependencies:** Phase 1.

**Complexity:** Low

**Notes:** Brief 10 covers this as a launch checklist item; deferred here if not blocking initial TestFlight distribution.

---

## Proposed Next 5 Implementation Tasks

In priority order, based on dependency chain and unblocking the longest path to a testable end-to-end flow:

### Task 1: Auth Foundation — All Platforms
Implement brief 01 in full: Flutter auth screens wired to `AuthController`, session-reactive router redirects, retailer portal sign-in server action connected, admin portal sign-in connected with role guard. This unblocks everything else.

### Task 2: Retailer Onboarding — Server Actions (Steps 1–4)
Implement `saveBusinessDetails`, branding upload (Supabase Storage), categories selection, and location entry as real server actions that persist to the database. Advance `onboarding_step` on each save. Resume from persisted step on page load. Steps 5–8 (hours, links, offer, preview) can follow in a second pass.

### Task 3: Admin Moderation — Retailer Approve / Reject
Implement the admin portal retailer review queue and approve/reject/suspend actions. This is the gate that unblocks retailer subscriptions and live listings. Wire `/retailers` and `/retailers/[id]` pages to real data.

### Task 4: Retailer Subscription — Post-Approval Stripe Flow
Implement `create-retailer-checkout-session` edge function and extend `stripe-webhook` to handle retailer subscription events. Wire the subscription step in the retailer portal. This completes the retailer activation loop.

### Task 5: Consumer Membership Purchase — Flutter Wired End-to-End
Wire the Flutter paywall to `create-checkout-session`, handle the Stripe redirect deep link, confirm `stripe-webhook` activates `consumer_memberships`, and wire `membershipProvider` to live data. This completes the consumer activation loop and unblocks all gated features (redemption, discovery CTAs, favourites).
