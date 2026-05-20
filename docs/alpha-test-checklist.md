# Alpha Test Checklist

Minimum end-to-end test covering the full consumer and retailer journeys.
Run against a staging Supabase project with live Stripe test keys.

---

## Prerequisites

- Supabase project running with all migrations applied (001–037)
- All six edge functions deployed:
  `create-checkout-session`, `create-membership-pass-token`,
  `create-redemption-token`, `create-retailer-checkout-session`,
  `stripe-webhook`, `validate-qr-token`
- Stripe webhook endpoint configured for the staging URL, forwarding:
  `checkout.session.completed`, `invoice.paid`, `invoice.payment_failed`,
  `customer.subscription.deleted`
- Retailer portal and admin portal deployed or running locally
- Flutter app built against the staging environment
- Two test email addresses available: one for the retailer, one for the consumer

---

## 1. Create test data and admin user

- [ ] Run the seed demo data migration or insert a test retailer manually
- [ ] Create an admin profile via SQL:
  ```sql
  update profiles set role = 'admin' where email = 'your-admin@example.com';
  ```
- [ ] Sign in to the admin portal — confirm the dashboard loads without errors
- [ ] Confirm the Retailers list is visible and the "Not activated" tab exists

---

## 2. Retailer onboarding

- [ ] Open the retailer portal and sign up with the retailer test email
- [ ] Complete the profile/onboarding form (name, address, description)
- [ ] Upload a logo and cover image
- [ ] Add at least one offer (title, value text, short summary)
- [ ] Assign at least one category to the retailer
- [ ] Confirm the portal shows `approval_status = pending` and billing status as locked

---

## 3. Admin approval

- [ ] Sign in to the admin portal as the admin user
- [ ] Navigate to Retailers → Pending queue
- [ ] Open the test retailer and confirm all submitted details are visible
- [ ] Approve the retailer
- [ ] Confirm the retailer moves to Approved status
- [ ] Confirm `approval_status = approved` and `visibility_status` remains `draft`
  (not yet live — subscription required)
- [ ] Confirm the "Not activated" tab in the admin portal shows the retailer

---

## 4. Retailer billing activation

- [ ] Sign in to the retailer portal as the retailer user
- [ ] Navigate to Billing
- [ ] Confirm the "Activate your listing" panel is shown (not the locked/unapproved state)
- [ ] Click "Activate listing" — confirm redirect to Stripe Checkout
- [ ] Complete checkout using Stripe test card `4242 4242 4242 4242`
- [ ] Confirm redirect to the billing success page after Stripe
- [ ] Wait for webhook processing (allow ~5 seconds)
- [ ] Reload the Billing page — confirm status shows **Active** with a renewal date
- [ ] Confirm the dashboard activation card collapses to the "Your listing is live" banner
- [ ] Confirm `visibility_status = live` in Supabase (`retailers` table)
- [ ] Confirm the offer created in step 2 has `status = live` (or approve it via admin if pending)

---

## 5. Consumer membership activation

- [ ] Sign up in the Flutter app with the consumer test email
- [ ] Complete profile setup
- [ ] Navigate to the Card tab — confirm the paywall or inactive state is shown
- [ ] Tap "Get membership" and complete checkout with Stripe test card `4242 4242 4242 4242`
- [ ] Return to the app after Stripe redirect
- [ ] Wait for webhook processing
- [ ] Confirm `consumer_memberships.status = active` in Supabase
- [ ] Confirm the Card tab now shows the membership pass QR
- [ ] Confirm the QR has a visible countdown timer

---

## 6. Consumer discovery

- [ ] Open the Home tab in the Flutter app
- [ ] Confirm "Trending near you" section loads and shows the test retailer
- [ ] Confirm the retailer card shows:
  - Cover image or placeholder
  - Retailer name
  - Category label (if assigned)
  - Featured offer value badge (if offer has `value_text`)
  - Heart icon placeholder (top-right)
- [ ] Tap the retailer card — confirm `RetailerDetailScreen` opens
- [ ] Confirm the detail screen shows:
  - Cover image
  - Logo
  - Name and address
  - Category chips
  - Description
  - At least one live offer in the offers list
- [ ] Tap "See all" — confirm the Explore tab loads the full offer list

---

## 7. Offer detail

- [ ] From the retailer detail screen, tap a live offer
- [ ] Confirm `OfferDetailScreen` shows:
  - Value badge (`value_text`)
  - Offer title
  - Retailer name (tappable, returns to retailer detail)
  - Short summary
  - Validity date if `end_at` is set
  - Terms if present
- [ ] Confirm the bottom CTA shows **"Use this offer"** (not "Redeem offer")
- [ ] Sign out and sign back in as a user with no membership
- [ ] Navigate to the same offer — confirm the CTA shows **"Get membership"** instead

---

## 8. Generate offer QR

- [ ] Sign back in as the active consumer member
- [ ] Navigate to a live offer and tap **"Use this offer"**
- [ ] Confirm the QR screen title is "Use this offer"
- [ ] Confirm the offer title is displayed above the QR code
- [ ] Confirm a QR code is rendered within a few seconds
- [ ] Confirm the countdown timer starts (should begin near 05:00)
- [ ] Confirm the countdown colour turns amber below 01:00 and red below 00:30
- [ ] Wait for T-30 seconds — confirm no visible disruption (silent refresh fires in background)
- [ ] After silent refresh: confirm the countdown resets to near 05:00 with a new QR
- [ ] Allow a token to expire fully (or set `TOKEN_TTL_MINUTES = 1` for testing):
  - Confirm the QR greyscales and the expired overlay appears
  - Confirm "Generate new code" button appears
  - Tap it — confirm a fresh QR is generated and countdown restarts

---

## 9. Retailer scanner approval

- [ ] Sign in to the retailer portal as the retailer user
- [ ] Navigate to the scanner / validation tool
- [ ] Scan or paste a valid, unexpired offer QR token from the consumer app
- [ ] Confirm the response shows:
  - `token_type: redemption`
  - `valid: true`
  - `status: success`
  - Offer title and benefit text
- [ ] Confirm a row appears in the `redemptions` table in Supabase:
  - `status = success`
  - `offer_id` matches the test offer
  - `profile_id` matches the consumer profile
- [ ] Confirm `redemption_tokens.consumed_at` is set (token is single-use)

---

## 10. Failed cases

### 10a. Expired QR

- [ ] Generate a QR and wait for it to expire (or advance `expires_at` in the DB)
- [ ] Submit the expired token to `validate-qr-token`
- [ ] Confirm response: `valid: false`, `status: expired`
- [ ] Confirm no redemption row is created

### 10b. Already-used QR

- [ ] Take a token that was successfully redeemed in step 9
- [ ] Submit the same raw token string again to `validate-qr-token`
- [ ] Confirm response: `valid: false`, `status: rejected`
  (token's `consumed_at` is already set — RPC blocks reuse)
- [ ] Confirm no duplicate redemption row is created

### 10c. Non-member attempts QR generation

- [ ] Sign in as a user with no active membership (or expire the test membership in Supabase)
- [ ] Navigate to a live offer and tap **"Use this offer"**
- [ ] Confirm the QR screen shows the blocked state:
  - Message: "An active membership is required to use this offer."
  - **"Get membership"** button is visible
  - No QR is displayed, no retry button
- [ ] Tap "Get membership" — confirm navigation to the paywall

### 10d. Daily limit reached

- [ ] Set `max_redemptions_per_day = 1` on an offer rule in Supabase
- [ ] Redeem the offer once successfully (step 9)
- [ ] As the same consumer, tap "Use this offer" on the same offer again
- [ ] Confirm the QR screen shows the blocked state:
  - Message: "Daily limit reached for this offer. Try again tomorrow."
  - No retry button, no QR
- [ ] Confirm no new token was inserted in `redemption_tokens`

---

## Sign-off

| Area | Tester | Date | Pass |
|---|---|---|---|
| Test data / admin setup | | | |
| Retailer onboarding | | | |
| Admin approval | | | |
| Retailer billing | | | |
| Consumer membership | | | |
| Consumer discovery | | | |
| Offer detail | | | |
| QR generation | | | |
| Scanner approval | | | |
| Failed cases | | | |
