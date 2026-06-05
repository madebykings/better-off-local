# Better Off Local — Production Setup

Step-by-step checklist for standing up a production environment from scratch.
Work through the sections in order; later sections depend on earlier ones.

---

## 1. Supabase Project Setup

### Create the project

1. Log in to [supabase.com](https://supabase.com) and create a new project.
2. Choose a region close to your users (UK — `eu-west-2` or `eu-west-1`).
3. Set a strong database password and store it in your password manager.
4. Wait for the project to finish provisioning before continuing.

### Note your project credentials

From **Project Settings → API**, copy:

| Value | Used for |
|---|---|
| Project URL | `NEXT_PUBLIC_SUPABASE_URL` / `SUPABASE_URL` |
| `anon` public key | `NEXT_PUBLIC_SUPABASE_ANON_KEY` / `SUPABASE_ANON_KEY` |
| `service_role` secret key | `SUPABASE_SERVICE_ROLE_KEY` |

The `service_role` key bypasses RLS. Never expose it to the browser or commit it to git.

### Configure authentication

In **Authentication → Providers**, enable:

- **Email** — enable "Confirm email" for production. Set a custom SMTP provider (e.g. Resend, Postmark) under **Auth → SMTP Settings** to avoid Supabase's per-day send limits.
- **Google** (optional at launch) — requires OAuth credentials from Google Cloud Console.

In **Authentication → URL Configuration**:

- **Site URL**: `https://portal.betterofflocal.co.uk` (or your retailer portal domain)
- **Redirect URLs**: add all allowed redirect origins:
  - `https://portal.betterofflocal.co.uk/**`
  - `https://admin.betterofflocal.co.uk/**`
  - `https://betterofflocal.co.uk/**`
  - `betterofflocal://` (Flutter custom scheme fallback)

### Link the Supabase CLI

```bash
supabase login
supabase link --project-ref <your-project-ref>
```

---

## 2. Migrations to Apply

Apply all migrations in order. Every migration is idempotent-safe; do not skip or reorder.

```bash
supabase db push
```

This applies all files under `supabase/migrations/` against the linked project.

### Migration inventory

| # | File | What it does |
|---|---|---|
| 001 | `001_extensions.sql` | Enables `uuid-ossp`, `pgcrypto` |
| 002 | `002_profiles.sql` | `profiles` table, `user_role` enum (`consumer`, `retailer_user`, `admin`) |
| 003 | `003_categories.sql` | `categories` table |
| 004 | `004_retailers.sql` | `retailers` table, `approval_status` / `visibility_status` enums |
| 005 | `005_retailer_locations.sql` | `retailer_locations`, opening hours JSON |
| 006 | `006_consumer_memberships.sql` | `consumer_memberships` table |
| 007 | `007_retailer_subscriptions.sql` | `retailer_subscriptions` table, `retailer_subscription_status` enum |
| 008 | `008_offers.sql` | `offers` table |
| 009 | `009_offer_rules.sql` | `offer_rules` (caps, cooldowns, date/time windows) |
| 010 | `010_favourites.sql` | `favourites` |
| 011 | `011_redemption_tokens.sql` | Short-lived offer redemption tokens |
| 012 | `012_redemptions.sql` | `redemptions` history |
| 013 | `013_offer_views.sql` | `offer_views` analytics |
| 014 | `014_notifications.sql` | `notifications` |
| 015 | `015_admin_actions.sql` | `admin_actions` audit log |
| 016 | `016_audit_events.sql` | `audit_events` |
| 017 | `017_indexes.sql` | Core indexes |
| 018 | `018_rls_policies.sql` | All row-level security policies |
| 019 | `019_views_and_helpers.sql` | `public_live_retailers`, `public_live_offers` views; helper functions |
| 020 | `020_seed_reference_data.sql` | **Run in production.** Seeds the 10 launch categories |
| 021 | `021_profile_on_signup.sql` | Trigger: auto-create `profiles` row on auth sign-up |
| 022 | `022_membership_indexes.sql` | Consumer membership indexes |
| 023 | `023_redemption_indexes.sql` | Redemption indexes |
| 024 | `024_push_tokens.sql` | Push notification tokens |
| 025 | `025_notification_indexes.sql` | Notification indexes |
| 026 | `026_seed_demo_data.sql` | **Do NOT run in production.** Demo retailer and offers only |
| 027 | `027_verification_sessions.sql` | Online redemption verification sessions |
| 028 | `028_membership_pass_tokens.sql` | Membership pass QR tokens (5 min TTL) |
| 029 | `029_redeem_offer_token_rpc.sql` | `redeem_offer_token` Postgres RPC (transactional redemption) |
| 030 | `030_onboarding_columns.sql` | Retailer onboarding step tracking |
| 031 | `031_retailer_assets_bucket.sql` | Creates `retailer-assets` storage bucket (public) |
| 032 | `032_retailer_categories_rls.sql` | RLS for retailer categories |
| 033 | `033_retailer_preferred_contact.sql` | Preferred contact column |
| 034 | `034_offer_onboarding_source.sql` | `onboarding_source` column on offers |
| 035 | `035_changes_requested_status.sql` | Adds `changes_requested` approval status, `submitted_at` column |
| 036 | `036_retailer_billing_activation.sql` | Moves `stripe_customer_id` to `retailers`, checkout tracking columns, makes `admin_actions.admin_profile_id` nullable |
| 037 | `037_discovery_views.sql` | Adds `tagline` column to `retailers`; creates `consumer_discovery_retailers` and `consumer_discovery_offers` flat views for Flutter app |

> Migration 026 (`seed_demo_data`) is safe to run in **staging** for realistic test data. Do not run it in production — it inserts rows with fixed UUIDs.

---

## 3. Edge Functions to Deploy

Deploy all six edge functions:

```bash
supabase functions deploy create-checkout-session
supabase functions deploy create-retailer-checkout-session
supabase functions deploy create-membership-pass-token
supabase functions deploy create-redemption-token
supabase functions deploy validate-qr-token
supabase functions deploy stripe-webhook
```

Or deploy all at once:

```bash
supabase functions deploy
```

### Function responsibilities

| Function | Called by | Purpose |
|---|---|---|
| `create-checkout-session` | Flutter app | Consumer membership Stripe Checkout |
| `create-retailer-checkout-session` | Retailer portal | Retailer annual subscription Stripe Checkout |
| `create-membership-pass-token` | Flutter app | Issues 5-minute membership pass QR token |
| `create-redemption-token` | Flutter app | Issues single-use offer redemption QR token |
| `validate-qr-token` | Retailer portal scanner | Validates both pass tokens and redemption tokens |
| `stripe-webhook` | Stripe (webhook endpoint) | Handles all Stripe billing events for consumers and retailers |

---

## 4. Supabase Secrets Required

Set all secrets before any edge function handles live traffic. Supabase injects these as environment variables at runtime.

```bash
# Stripe
supabase secrets set STRIPE_SECRET_KEY=sk_live_...
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...

# Consumer checkout (Stripe Price IDs — see section 5)
supabase secrets set STRIPE_PRICE_ID_MONTHLY=price_...
supabase secrets set STRIPE_PRICE_ID_ANNUAL=price_...

# Retailer checkout (Stripe Price ID — see section 6)
supabase secrets set STRIPE_RETAILER_ANNUAL_PRICE_ID=price_...

# Retailer portal URL (used for Stripe success/cancel redirect URLs)
supabase secrets set RETAILER_PORTAL_URL=https://portal.betterofflocal.co.uk

# Grace period after a retailer subscription is cancelled before hiding the listing
# 0 = hide immediately. 7 = 7-day grace window.
supabase secrets set RETAILER_GRACE_DAYS=7

# Deep links — universal links (HTTPS) take priority; custom scheme is the fallback
# Set APP_UNIVERSAL_LINK_DOMAIN once AASA / DAL files are hosted (see section 10)
supabase secrets set APP_UNIVERSAL_LINK_DOMAIN=betterofflocal.co.uk
supabase secrets set APP_SCHEME=betterofflocal
```

`SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` are injected automatically by Supabase into all edge functions — you do not need to set them manually.

### Verify secrets are set

```bash
supabase secrets list
```

---

## 5. Stripe — Consumer Products and Prices

### Create in Stripe Dashboard (or via CLI)

**Product:** "Better Off Local — Consumer Membership"

Create two prices under this product:

| Price | Amount | Interval | Env var |
|---|---|---|---|
| Monthly | £2.99/month | `month` | `STRIPE_PRICE_ID_MONTHLY` |
| Annual | (optional at launch) | `year` | `STRIPE_PRICE_ID_ANNUAL` |

Both prices should use:
- Currency: `GBP`
- Billing scheme: `per_unit`
- `recurring` mode

After creating, copy the Price IDs (`price_...`) and set them as Supabase secrets (section 4).

### Subscription metadata

The `create-checkout-session` function sets `subscription_data.metadata.supabase_user_id` on every checkout session. The webhook reads this to associate the Stripe subscription with the correct Supabase profile. Do not remove it.

---

## 6. Stripe — Retailer Products and Prices

**Product:** "Better Off Local — Retailer Annual Listing"

Create one price:

| Price | Amount | Interval | Env var |
|---|---|---|---|
| Annual | agreed launch price | `year` | `STRIPE_RETAILER_ANNUAL_PRICE_ID` |

- Currency: `GBP`
- Billing scheme: `per_unit`
- `recurring` mode

After creating, copy the Price ID and set it as a Supabase secret (section 4).

### Notes

- Only the annual plan is supported at launch. The price ID is the source of truth — no amount is hardcoded in the application.
- The `create-retailer-checkout-session` function reads `STRIPE_RETAILER_ANNUAL_PRICE_ID` at runtime. Changing the price in Stripe requires updating this secret and redeploying (or the secret update takes effect on next cold start).

---

## 7. Stripe Webhook Endpoint and Events

### Create the webhook endpoint

In **Stripe Dashboard → Developers → Webhooks**, add an endpoint:

**URL:**
```
https://<supabase-project-ref>.supabase.co/functions/v1/stripe-webhook
```

Find your project ref in the Supabase dashboard URL or via `supabase status`.

### Events to subscribe

Subscribe to exactly these four events:

| Event | Handled for |
|---|---|
| `checkout.session.completed` | Retailer — links subscription ID to pending row |
| `invoice.paid` | Consumer + Retailer — activates subscription, sets visibility live |
| `invoice.payment_failed` | Consumer + Retailer — marks past due |
| `customer.subscription.deleted` | Consumer + Retailer — cancels subscription, hides retailer |

### Retrieve the webhook signing secret

After creating the endpoint, Stripe shows the **Signing secret** (`whsec_...`). Copy it and set it as the `STRIPE_WEBHOOK_SECRET` Supabase secret (section 4).

### Routing logic

The webhook differentiates consumer vs retailer events by inspecting `subscription.metadata.type`:
- `type = 'retailer_subscription'` → retailer path
- No `type` (or `supabase_user_id` present) → consumer path

Do not change these metadata keys without updating both the checkout session creation functions and the webhook handler.

---

## 8. Storage Buckets

Migration 031 creates the `retailer-assets` bucket automatically when applied. No manual step is needed if migrations are run via `supabase db push`.

If creating manually:

1. Go to **Storage** in the Supabase dashboard.
2. Create a bucket named `retailer-assets`.
3. Set it to **Public** (reads are unauthenticated; writes are service-role only).

### Path convention

```
retailer-assets/{retailer_id}/{logo|cover}-{uuid}.webp
```

All uploads are handled server-side via the service-role client (in the retailer portal branding action). No client-side writes to this bucket are permitted.

---

## 9. Admin User Setup

There is no admin sign-up UI. Admin accounts must be promoted manually after a normal sign-up.

### Steps

1. Sign up at `https://admin.betterofflocal.co.uk/sign-up` using the admin email address.
2. Confirm the email address.
3. In the Supabase dashboard, open **Table Editor → profiles** (or run via SQL editor):

```sql
UPDATE profiles
SET role = 'admin'
WHERE email = 'admin@betterofflocal.co.uk';
```

> `email` is not a column on `profiles` — use `id` instead, looked up from `auth.users`:

```sql
UPDATE profiles
SET role = 'admin'
WHERE id = (
  SELECT id FROM auth.users WHERE email = 'admin@betterofflocal.co.uk'
);
```

4. The admin can now sign in at the admin portal. All admin pages call `requireAdmin()` which checks `profiles.role = 'admin' AND is_active = true`.

### Creating additional admin accounts

Repeat the same process for each admin user. There is no limit on the number of admin accounts.

---

## 10. Deep Links and Universal Links

Deep links are required for:
- **Consumer checkout**: Stripe redirects back to the Flutter app after payment
- **Future**: offer detail pages, retailer profile pages

### Custom scheme (fallback)

The app uses `betterofflocal://` as a fallback for environments where HTTPS universal links are not yet configured.

Flutter handles incoming URIs via the `app_links` package. The custom scheme must be registered in:
- **iOS**: `ios/Runner/Info.plist` — add a `CFBundleURLSchemes` entry with `betterofflocal`
- **Android**: `android/app/src/main/AndroidManifest.xml` — add an `intent-filter` with `scheme="betterofflocal"`

### iOS Universal Links (AASA)

To use HTTPS universal links (`https://betterofflocal.co.uk/...`):

1. Host the Apple App Site Association file at:
   ```
   https://betterofflocal.co.uk/.well-known/apple-app-site-association
   https://betterofflocal.co.uk/apple-app-site-association
   ```
2. The file must be served with `Content-Type: application/json` (no `.json` extension).
3. Include your app's team ID and bundle identifier in the `applinks` section.
4. Enable the **Associated Domains** capability in Xcode with `applinks:betterofflocal.co.uk`.

Once hosted and verified, update the edge function secret:
```bash
supabase secrets set APP_UNIVERSAL_LINK_DOMAIN=betterofflocal.co.uk
```

### Android App Links (Digital Asset Links)

1. Host the DAL file at:
   ```
   https://betterofflocal.co.uk/.well-known/assetlinks.json
   ```
2. Include your app's `package_name` and `sha256_cert_fingerprints` (from Play Console or `keytool`).
3. Add an `intent-filter` in `AndroidManifest.xml` with `autoVerify="true"`.

### Stripe redirect deep link

The consumer checkout success URL is currently configured as either:
- `https://betterofflocal.co.uk/subscription-success` (when `APP_UNIVERSAL_LINK_DOMAIN` is set)
- `betterofflocal://subscription-success` (custom scheme fallback)

The Flutter app routes this URI to the post-payment confirmation screen.

---

## 11. Test Data Required

### Reference data (applied by migrations — no manual step)

Migration 020 seeds 10 categories for the Clackmannanshire launch:
Cafes, Restaurants, Bars, Beauty, Fitness, Shopping, Services, Health, Activities, Food & Drink.

These are applied automatically with `supabase db push`. Do not re-insert them manually.

### Test accounts to create

Before end-to-end testing, create the following accounts manually:

| Type | Purpose |
|---|---|
| Admin user | Promote via SQL after sign-up (see section 9) |
| Consumer (no membership) | Test gated content, paywall, and upsell |
| Consumer (active membership) | Test offer discovery, redemption, QR scanning |
| Retailer owner | Test full onboarding flow, submission, activation |

### Stripe test cards

Use Stripe's standard test cards in test mode:

| Card number | Scenario |
|---|---|
| `4242 4242 4242 4242` | Successful payment |
| `4000 0000 0000 9995` | Declined (insufficient funds) |
| `4000 0025 0000 3155` | 3D Secure required |

Use any future expiry date, any 3-digit CVC, and any UK postcode.

### First retailer to onboard

Create one test retailer that goes through the full lifecycle:
1. Sign up → complete onboarding → submit for review
2. Admin approves via the review queue
3. Retailer activates subscription via Stripe Checkout (test mode)
4. Webhook fires `invoice.paid` → `visibility_status` flips to `live`
5. Consumer app should now show the retailer and its offers

---

## 12. End-to-End Test Checklist

Work through each flow in sequence. All items should pass before going live.

### Consumer flow

- [ ] Sign up with email — confirmation email received
- [ ] Sign in — lands on home screen
- [ ] Home screen shows location permission prompt
- [ ] Granting location shows nearby offers (requires at least one live retailer in range)
- [ ] Paywall shown when attempting to view offer detail without membership
- [ ] Stripe Checkout opens (test mode) from paywall
- [ ] Completing payment redirects back to app via deep link
- [ ] Membership card screen shows active status and QR code
- [ ] Offer detail screen accessible after membership activation
- [ ] Redemption token QR generated (5-minute TTL)
- [ ] Membership pass QR generated from membership card screen
- [ ] Favouriting a retailer persists across sessions
- [ ] Notification received (if push token registered)

### Retailer portal flow

- [ ] Sign up → sign in → redirected to onboarding
- [ ] All onboarding steps completable: business details, branding (logo + cover upload), categories, location, opening hours, links, first offer
- [ ] Preview screen shows listing card with correct data
- [ ] Submission sets `onboarding_step = 'submitted'` and `approval_status = 'pending'`
- [ ] After admin rejects with note: retailer sees "changes requested" status and can resubmit
- [ ] After admin approves: dashboard shows "Activate your listing" CTA
- [ ] Clicking activate opens Stripe Checkout (test mode)
- [ ] Completing payment → `billing/success` page shown
- [ ] Webhook fires → `retailer_subscriptions.status = 'active'` and `retailers.visibility_status = 'live'`
- [ ] Dashboard activation card collapses to "Your listing is live" banner
- [ ] Billing page shows active plan with renewal date

### Admin portal flow

- [ ] Sign in with promoted admin account
- [ ] Review queue shows submitted retailers with quality badges
- [ ] Retailer detail page shows listing preview and audit timeline
- [ ] Approve action sets `approval_status = 'approved'`
- [ ] Reject action (requires note) sets `approval_status = 'rejected'`
- [ ] Request changes action sets `approval_status = 'changes_requested'`
- [ ] Retailers list shows Subscription column and "Not activated" tab
- [ ] "Not activated" tab lists approved retailers without active subscription

### Redemption flow (requires live retailer + active consumer member)

- [ ] Consumer generates redemption token QR from offer detail screen
- [ ] Retailer scanner reads QR — token validated as `success`
- [ ] Second scan of same token returns appropriate rejection (already consumed)
- [ ] Expired token (>5 min) rejected correctly
- [ ] Consumer with no membership: token rejected with `membership_invalid`
- [ ] Retailer dashboard shows redemption in recent activity

### Webhook reliability

- [ ] Trigger `invoice.paid` via Stripe test dashboard → subscription activates
- [ ] Trigger `invoice.payment_failed` → subscription marked `past_due`, listing stays live
- [ ] Trigger `customer.subscription.deleted` → `visibility_status = 'hidden'` (after grace period)
- [ ] Repeat failed webhook delivery (retry from Stripe dashboard) — idempotent, no duplicate records

---

## 13. Known Launch Blockers

These are items that must be resolved before going live. They are implemented as stubs or TODOs in the current codebase.

### Critical

**Retailer approval email notifications**
The `notifyRetailerApprovalStatus` function in `apps/admin/lib/actions/moderation.ts` is a stub (`console.log` only). Retailers currently receive no email when their application is approved, rejected, or when changes are requested. An email provider (Resend, Postmark, or similar) must be integrated before launch.

**Consumer Stripe checkout in Flutter**
The Flutter paywall screen (`apps/mobile/lib/features/memberships/presentation/paywall_screen.dart`) is not yet wired to the `create-checkout-session` edge function. Consumers cannot currently purchase a membership in the app. This blocks the entire paid consumer flow.

**Consumer membership provider**
The Flutter `membershipProvider` is not wired to live Supabase data. The paywall and membership-gated features rely on this provider reflecting the actual `consumer_memberships` state in real time.

**Deep link hosting**
The AASA and Digital Asset Links files are not yet hosted. Until they are, Stripe will redirect to the custom scheme fallback (`betterofflocal://`), which may not work reliably in all browser contexts on iOS. Universal links must be configured before App Store submission.

### Important (should fix before launch, not strictly blocking)

**Brand assets not deployed**
The `shared/brand/` directory exists but is empty pending logo file creation. Logos must be added and copied to app `public/brand/` directories via `node scripts/copy-brand-assets.js` before the web apps show the correct branding. Flutter PNG assets must also be placed at `apps/mobile/assets/images/`.

**Admin portal stubs**
Several admin pages are unimplemented placeholders (Categories, Featured, Members, Redemptions, Subscriptions, Settings, Audit). These are not needed for initial retailer onboarding and billing but should be built before scaling.

**Retailer portal post-activation pages**
Several retailer portal pages are stubs (Locations, Offers management, Profile, Settings). Retailers can complete onboarding and activate, but cannot manage their listing post-activation.

**Push notifications**
The `push_tokens` table and notifications infrastructure is in place but the Flutter app does not yet register for or display push notifications. Approval/rejection emails (above) partially mitigate this, but in-app notifications are expected at launch.

**Google Maps API key**
The Flutter `GOOGLE_MAPS_API_KEY` is required for the map discovery screen. Without it, the map will not render. The key must be obtained from Google Cloud Console with the Maps SDK for iOS and Android enabled.

**No Stripe customer portal**
There is no self-service subscription management UI for retailers (cancellation, updating payment method). Retailers must contact support or changes must be made directly in the Stripe dashboard. This is acceptable at a small launch scale but should be addressed soon after.
