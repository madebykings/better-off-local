# Better Off Local – Online Redemption Architecture

## Overview

Online redemption extends the Better Off Local verification platform to e-commerce
checkouts and websites. It allows a retailer's website to verify that a visitor is an
active Better Off Local member and apply a member benefit — without ever displaying a
discount code.

The core principle is identical to in-store redemption: **the server verifies, not the
client**. The website never knows whether a person is a member until the BOL backend
confirms it. The benefit is applied server-side by the platform connector.

---

## Why No Discount Codes

Discount codes are fundamentally insecure for a membership platform:

- They can be shared, screenshot, or found via search
- They cannot be tied to a specific member
- They cannot enforce per-member rules (one per user, one per day, etc.)
- They undermine the premium membership positioning

Better Off Local never generates or displays discount codes. The only signal a website
ever receives is a signed, server-issued approval for a specific verification session.

---

## Actors

| Actor | Role |
|---|---|
| Consumer | Active BOL member visiting a retailer's website |
| BOL Mobile App | Scans the website QR and authorises the session |
| BOL Backend | Issues sessions, validates members, records outcomes |
| Website Widget | Embedded JS that displays QR and polls for approval |
| Platform Connector | WooCommerce plugin / Shopify app / custom integration that applies the benefit |

---

## Verification Session Concept

A **verification session** is a short-lived, server-issued token that represents a
pending membership check on a specific retailer's website. It is the online equivalent of
a redemption token in in-store flow.

### Session States

```
pending → approved → (connector applies benefit)
        → rejected
        → expired
```

- `pending`: session created, consumer has not yet scanned
- `approved`: consumer scanned and backend confirmed active membership
- `rejected`: consumer scanned but membership was invalid or rules blocked it
- `expired`: session was not acted on within TTL

Sessions are single-use. Approval is irrevocable.

### Session TTL

Default: 10 minutes. The widget shows a countdown and can request a new session if
the previous one expires before the consumer scans.

---

## Online Redemption Flow

### Step 1 — Widget loads on retailer's website

The retailer has installed the BOL widget script:

```html
<script src="https://cdn.betterofflocal.co.uk/widget.js"
        data-retailer-id="<retailer-uuid>"
        data-offer-id="<offer-uuid>">  <!-- optional -->
</script>
```

The widget initialises and calls the BOL backend to create a verification session.

### Step 2 — Backend creates a verification session

`POST /functions/v1/create-verification-session`

Input:
- `retailer_id` — from widget configuration
- `offer_id` — optional, if the benefit is offer-specific
- `platform` — `woocommerce`, `shopify`, or `widget`
- `platform_order_ref` — optional, platform-specific correlation ID

Backend:
- Verifies retailer exists and is live
- Creates a `verification_sessions` row with status `pending`
- Returns: `{ session_token, expires_at }` — raw token (not the hash)

### Step 3 — Widget displays QR code

The widget renders a QR code whose value is the raw session token. It shows:

> "Better Off Local member? Scan with your BOL app to unlock your member benefit."

No price, no code, no description of the discount.

The widget begins polling:
`GET /functions/v1/poll-verification-session?token=<raw_token>`

Polling interval: every 2 seconds.

### Step 4 — Consumer scans with BOL app

The consumer opens the BOL mobile app and taps "Scan Online Checkout" (a dedicated
action, separate from showing their own QR). The app opens a QR scanner.

The consumer points the camera at the website QR.

### Step 5 — App calls approve-verification-session

`POST /functions/v1/approve-verification-session`

Headers: `Authorization: Bearer <consumer_jwt>`

Input:
- `session_token` — scanned from the website QR

Backend checks (in order):
1. Consumer is authenticated
2. Consumer has an active membership (`active` or `trialing`, within period)
3. Session exists and status is `pending`
4. Session belongs to a live retailer
5. If offer-specific: offer is live and offer rules allow this consumer
6. Session is not expired

On pass:
- Sets `session.status = 'approved'`
- Sets `session.consumer_profile_id`
- Sets `session.approved_at`
- Records a `redemptions` row (type: `online`, status: `success`)
- Notifies the connector webhook (if registered) — see connector docs
- Returns `{ approved: true, memberName, offerTitle? }`

On fail:
- Returns `{ approved: false, reason }` (safe, user-facing message)
- Optionally sets `session.status = 'rejected'` with reason

### Step 6 — Widget receives approval

The polling call returns `{ status: 'approved' }`. The widget:
- Hides the QR
- Shows a member confirmation message
- Fires the `bolSessionApproved` JavaScript event with the session ID

The platform connector (WooCommerce plugin etc.) is listening for this event and/or
the server-side webhook, and applies the discount to the cart.

### Step 7 — Benefit is applied server-side

The platform connector receives confirmation and applies the benefit via platform APIs:
- WooCommerce: injects a cart fee / discount line item via a PHP hook
- Shopify: applies a draft order discount via the Shopify Admin API
- Custom: handles the `bolSessionApproved` event however the retailer needs

No discount code is generated. No code is visible. The connector is the source of truth
for what the benefit actually means commercially.

---

## Session Token Security

- The widget receives only the raw token
- The BOL backend stores only the SHA-256 hash of the token
- The raw token is never written to the database
- The token cannot be guessed — it is a cryptographically random UUID
- Session polling returns status only — no membership data is leaked

---

## Offer Rule Enforcement

Online redemption enforces the same offer rules as in-store:

- `max_redemptions_per_user` — checked against `redemptions` for this consumer + offer
- `max_redemptions_per_day` — checked for UTC day
- `max_redemptions_total` — checked globally for offer
- `start_at` / `end_at` — offer date window enforced
- `new_customers_only` — checked if configured (future)

Rules are evaluated server-side during `approve-verification-session`. If any rule
blocks the redemption, the session is rejected and the benefit is not applied.

---

## Atomicity

The `approve-verification-session` function must atomically transition the session from
`pending` to `approved` using:

```sql
UPDATE verification_sessions
SET status = 'approved', consumer_profile_id = $1, approved_at = now()
WHERE id = $2 AND status = 'pending'
RETURNING id;
```

If 0 rows are returned, the session was already approved or expired. This prevents two
simultaneous scans from both succeeding.

---

## Redemption Record

Every online redemption outcome is written to the `redemptions` table. Fields:
- `status`: `success` or `membership_invalid` / `rule_blocked` / `rejected`
- `offer_id`: set if offer-specific, null if retailer-level
- `retailer_id`: always set
- `profile_id`: set on approval (may be null on rejection if consumer wasn't identified)
- A new `redemption_type` field should distinguish `instore` from `online`

This ensures:
- Consumers can see their online redemptions in redemption history
- Retailers can see online vs in-store breakdown in analytics
- Admins can monitor and audit online sessions

---

## Platform Connector Webhook

When a session is approved, the BOL backend optionally notifies the platform connector
via a registered webhook URL:

```
POST <connector_webhook_url>
Authorization: Bearer <shared_secret>

{
  "event": "session.approved",
  "session_id": "<uuid>",
  "retailer_id": "<uuid>",
  "offer_id": "<uuid | null>",
  "approved_at": "<iso8601>"
}
```

The connector uses this to apply the benefit server-side before the consumer completes
checkout. The `shared_secret` is set when the retailer registers their connector.

Webhook delivery should be best-effort with a short timeout. If the webhook fails, the
JS event on the widget still fires so the consumer-facing experience is not blocked.

---

## Database Tables

### verification_sessions
See `supabase/migrations/027_verification_sessions.sql`.

Primary fields:
- `id` — UUID primary key
- `retailer_id` — linked retailer (must be live)
- `offer_id` — optional, for offer-specific sessions
- `session_token_hash` — SHA-256 of raw token, indexed, unique
- `status` — `pending | approved | rejected | expired`
- `platform` — `widget | woocommerce | shopify`
- `platform_order_ref` — optional correlation with platform order
- `consumer_profile_id` — set on approval
- `expires_at` — session TTL
- `approved_at` — set on approval

---

## Edge Functions Required

| Function | Caller | Purpose |
|---|---|---|
| `create-verification-session` | Widget / connector | Create session, return raw token |
| `approve-verification-session` | Consumer mobile app | Validate member, approve session |
| `poll-verification-session` | Widget | Check session status, no auth required |

---

## Future Extensions

- Session analytics: track how many sessions were created vs approved per retailer
- Shopify app: native Shopify integration
- Webflow / Squarespace / Wix: widget works on all of these without change
- Session-level offer rules separate from in-store offer rules
- Location verification: optional check that consumer is near the retailer's registered
  area before approving an online session
