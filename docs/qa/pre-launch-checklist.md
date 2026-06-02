# Pre-Launch QA Checklist

Executable by a human tester. Each item includes the user journey, expected result, and where to verify.

---

## 1. Consumer App — Onboarding & Auth

| # | Step | Expected result | Verify |
|---|------|-----------------|--------|
| 1.1 | Download app from Play Store / TestFlight | App installs with name "Better Off Local" (no underscores) | Device home screen |
| 1.2 | Open app | Splash screen shows logo on off-white background | Visual |
| 1.3 | Tap "Sign up" | Reaches email/password registration screen | App |
| 1.4 | Complete sign-up with valid email | Confirmation email received; redirected to region selection | Email + App |
| 1.5 | Select region (Clackmannanshire) | Profile `region_id` populated; navigates to home | Supabase: `profiles.region_id` |
| 1.6 | Skip to home without region | Router gates access until region is selected | App |
| 1.7 | Sign out and sign back in | Session restored; region retained | App |

---

## 2. Consumer App — Membership & Payment

| # | Step | Expected result | Verify |
|---|------|-----------------|--------|
| 2.1 | Navigate to paywall without membership | Paywall shown with plan options | App |
| 2.2 | Select Monthly plan and pay via Stripe | Stripe checkout completes; app navigates to success screen | Stripe dashboard → Customers |
| 2.3 | Check membership card | Card shows member name, membership status "Active", QR code | App: Account → View pass |
| 2.4 | Annual plan purchase | Stripe invoice shows annual product; card shows "Annual member" | Stripe + App |
| 2.5 | QR code refreshes every 60 seconds | New QR generated; old QR does not redeem | App (observe) |
| 2.6 | Manage Plan → opens Stripe customer portal | Stripe portal loads in browser with active subscription | Browser |
| 2.7 | Cancel subscription in portal | `memberships.cancel_at_period_end = true`; card shows "Ends [date]" | Supabase: `memberships` |

---

## 3. Consumer App — Offers & Discovery

| # | Step | Expected result | Verify |
|---|------|-----------------|--------|
| 3.1 | Home screen loads | Nearby offers section shows offer cards using shared `OfferCardCompact` | Visual — consistent card design |
| 3.2 | Tap "See all" on nearby offers | Navigates to Explore screen | App |
| 3.3 | Tap offer card | Offer detail screen loads with full description and "Redeem" CTA | App |
| 3.4 | Attempt redeem without membership | Paywall shown | App |
| 3.5 | Redeem offer with active membership | QR scan modal opens; valid QR accepted by retailer scanner | App + Scanner |
| 3.6 | Redeem one-per-day offer twice in same day | Second attempt blocked with clear message | App |
| 3.7 | Map screen — tap marker | Card shows "X offers available" (not featured offer value) | Visual |
| 3.8 | Map screen — no debug overlay | No debug text or overlay visible | Visual |
| 3.9 | Search offer by name / category | Results filter correctly | App |
| 3.10 | Favourite an offer | Offer appears in Favourites; heart icon fills | App: Account → Favourites |

---

## 4. Consumer App — Savings Screen

| # | Step | Expected result | Verify |
|---|------|-----------------|--------|
| 4.1 | Navigate to My Savings (no redemptions) | Empty state with clear message | App |
| 4.2 | View savings after one redemption | Hero shows "Total savings £X.XX" (or £— if no estimated value) | App |
| 4.3 | Redemption with `estimated_saving_pence` set | Saving amount shown in hero and per-item | App + Supabase: `offers.estimated_saving_pence` |
| 4.4 | Redemption history list | Shows offer name, retailer, "Saved £X.XX", date | App |
| 4.5 | "This month" stat | Only counts redemptions in current calendar month | App |

---

## 5. Consumer App — Referral Programme

| # | Step | Expected result | Verify |
|---|------|-----------------|--------|
| 5.1 | Navigate to Refer a Friend | Screen loads with referral code and "Give a month, get a month" hero | App |
| 5.2 | Copy referral link | Link copied to clipboard: `https://betterofflocal.com/join?ref=CODE` | Clipboard |
| 5.3 | Share referral link | Share sheet opens with pre-filled message | App |
| 5.4 | New user signs up via referral link | `profiles.referred_by_code_id` set; `referral_invitations` row created | Supabase |
| 5.5 | Referred user completes first payment | `referral_rewards` row created with status `pending` | Supabase: `referral_rewards` |
| 5.6 | After grace period (7 days default) | Status changes to `confirmed`; referrer's "Free months" count increases | Supabase + App |
| 5.7 | Stats dashboard shows months not cash | "Free months: 1", "Value saved: £9.95" (not "Rewards: £9.95") | App |
| 5.8 | Referral from own code | Self-referral blocked; error returned | App (attempt self-referral) |
| 5.9 | Admin: view referrals | Rewards listed with months column | Admin portal: /referrals |
| 5.10 | Admin: void a pending reward | Status changes to `voided`; not applied to Stripe | Admin + Supabase |

---

## 6. Consumer App — Region & Community

| # | Step | Expected result | Verify |
|---|------|-----------------|--------|
| 6.1 | Navigate to My region | Shows region name, member count, retailer count, live offers | App |
| 6.2 | Region progress bar | Fills proportionally to `active_member_count / member_threshold` | App |
| 6.3 | "Invite friends" button in region screen | Navigates to Refer a Friend screen | App |
| 6.4 | Change region | Region selection screen loads; selecting new region updates `profiles.region_id` | App + Supabase |
| 6.5 | Community copy | Does not mention "buying power"; focuses on local businesses | Visual |

---

## 7. Consumer App — Account

| # | Step | Expected result | Verify |
|---|------|-----------------|--------|
| 7.1 | Account screen loads | Shows profile, membership, activity shortcuts | App |
| 7.2 | Activity shortcuts order | Favourites → My Region → My Savings → Redemption History → Refer a Friend | Visual |
| 7.3 | Edit name | Name updates immediately on account screen | App + Supabase: `profiles.full_name` |
| 7.4 | Change avatar | Image uploads to `consumer-assets` bucket; avatar updates | App + Supabase Storage |
| 7.5 | Change email | Confirmation sent to new address; change pending until confirmed | Email + Supabase Auth |
| 7.6 | App version number | Displays correct version (no "dev" or placeholder) | Visual |

---

## 8. Retailer Portal — Onboarding

| # | Step | Expected result | Verify |
|---|------|-----------------|--------|
| 8.1 | Visit retailer portal signup URL | Registration page loads cleanly | Browser |
| 8.2 | Complete sign-up | Email confirmation sent; redirected to onboarding | Email + Portal |
| 8.3 | Complete business profile | Business name, address, category saved | Supabase: `retailers` |
| 8.4 | Stripe billing setup | Stripe checkout for retailer plan completes | Stripe |
| 8.5 | Retailer in "Pending" state | Not visible in consumer app until approved | Admin portal + Consumer app |
| 8.6 | Admin approves retailer | Retailer becomes visible in consumer app | Admin: /retailers + Consumer app |

---

## 9. Retailer Portal — Offer Management

| # | Step | Expected result | Verify |
|---|------|-----------------|--------|
| 9.1 | Create offer with all fields | Offer saved with status "draft" | Supabase: `offers` |
| 9.2 | Publish offer | Status changes to "live"; appears in consumer app | Consumer app |
| 9.3 | Upload cover image | Image appears on offer card in consumer app | Consumer app |
| 9.4 | Edit a live offer | Changes reflected in consumer app within seconds | Consumer app |
| 9.5 | Set one-per-day redemption rule | Second redemption in same day blocked | Consumer app (test twice) |
| 9.6 | Set `estimated_saving_pence` | Value flows to consumer savings screen | Consumer app: My Savings |
| 9.7 | Set offer start/end dates | Offer only visible within date range | Consumer app |

---

## 10. Retailer Portal — Analytics

| # | Step | Expected result | Verify |
|---|------|-----------------|--------|
| 10.1 | Dashboard loads | Shows region, active members, businesses, offers | Portal |
| 10.2 | Offer performance — views | Increments when offer is viewed in consumer app | Portal + Consumer app |
| 10.3 | Offer performance — redemptions | Increments after successful QR redemption | Portal + Consumer app |
| 10.4 | Analytics numbers are real | No hardcoded or placeholder data | Visual + DB comparison |

---

## 11. Admin Portal — Core Functions

| # | Step | Expected result | Verify |
|---|------|-----------------|--------|
| 11.1 | Sign in as admin | Admin dashboard loads | Portal |
| 11.2 | Review pending retailer | Retailer detail with notes field visible | Portal: /review |
| 11.3 | Approve retailer | `approval_status = approved`; retailer can now submit offers | Supabase + Retailer portal |
| 11.4 | Reject retailer | Status set to rejected; retailer informed | Supabase |
| 11.5 | View all members | Member list with status, plan, region | Portal: /members |
| 11.6 | View referral rewards | Table shows months not cash; config summary visible | Portal: /referrals |
| 11.7 | Void a referral reward | Status → voided | Supabase: `referral_rewards` |
| 11.8 | Settings page | Referral config values displayed correctly | Portal: /settings |
| 11.9 | View regions | All active regions listed with thresholds | Portal: /regions |

---

## 12. Stripe Verification

| # | Step | Expected result | Verify |
|---|------|-----------------|--------|
| 12.1 | Successful consumer subscription | Subscription in Stripe with correct price ID | Stripe: Customers |
| 12.2 | Successful retailer subscription | Retailer plan active in Stripe | Stripe: Customers |
| 12.3 | Webhook delivery — invoice.payment_succeeded | Webhook event delivered; referral reward created if applicable | Stripe: Webhooks → delivery logs |
| 12.4 | Stripe customer portal session | Portal URL returned by backend; opens correctly | App + Stripe |
| 12.5 | Failed payment — consumer | `memberships.status = past_due`; consumer sees warning | Stripe test card + App |

---

## 13. QR Redemption End-to-End

| # | Step | Expected result | Verify |
|---|------|-----------------|--------|
| 13.1 | Retailer opens scanner | Camera permission requested and granted | Retailer portal: /scan |
| 13.2 | Consumer shows valid QR | Scanner accepts QR; redemption recorded | Supabase: `redemptions` |
| 13.3 | Consumer shows expired QR (>60s old) | Rejected with clear error message | Scanner |
| 13.4 | Non-member shows arbitrary QR | Rejected; no redemption created | Scanner |
| 13.5 | Redemption recorded with correct offer ID | `redemptions.offer_id` matches redeemed offer | Supabase |

---

## 14. Notifications

| # | Step | Expected result | Verify |
|---|------|-----------------|--------|
| 14.1 | Notification permission prompt | Appears on first app open after onboarding | App |
| 14.2 | New offer published in user's region | Push notification received (if enabled) | Device |
| 14.3 | Notification taps through | Tapping notification opens relevant offer or screen | App |

---

## 15. Visual Consistency Audit

| # | Screen | Check |
|---|--------|-------|
| 15.1 | Home | Background is neutral off-white (not warm beige); offer cards match Explore style |
| 15.2 | Offers / Explore | Card style, spacing, badge colours consistent |
| 15.3 | Map | No debug overlay; marker taps show offer count |
| 15.4 | Membership Card | Gradient fills entire header; premium feel |
| 15.5 | Account | Shortcuts in correct order; consistent icons |
| 15.6 | Savings | "Total savings" hero is prominent; redemption count is secondary |
| 15.7 | Referral | "Give a month, get a month" headline; months displayed not cash |
| 15.8 | Region/Community | Local business focus; referral CTA integrated |
| 15.9 | Android launcher | App name reads "Better Off Local" (not "better_off_local") |
| 15.10 | All screens | No hardcoded placeholder text, "TODO", or "lorem ipsum" |

---

*Checklist version: 1.0 — 2026-06-02*
