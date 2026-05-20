# Better Off Local – Implementation Brief 04
# Redemption Engine

## Objective
Implement the secure redemption flow for Better Off Local.

Consumers must be able to redeem a live offer through the mobile app.
Retailers must be able to validate that redemption through the retailer portal.
All validation must happen server-side.

This is a security-critical system.

---

## Core Flow

The primary discount redemption flow is **always offer-specific**. The consumer selects a specific
offer, the app generates a QR for that offer, and the retailer scans once. There is no separate
membership verification step and no mode switching on the scanner.

1. Consumer opens an offer in the mobile app
2. Offer detail screen shows live availability state before the consumer commits:
   - eligible to redeem
   - already redeemed (per-user or per-day cap hit) — show next available time
   - offer expired or paused
   - no active membership — prompt to subscribe
3. Consumer taps Redeem
4. Backend checks at token creation (`create-redemption-token`):
   - authenticated user
   - active membership (`active` or `trialing`, within `current_period_end`)
   - live retailer
   - live offer
   - offer rules currently allow redemption (per-user cap, per-day cap, global cap, date window)
5. Backend generates a short-lived offer-specific token (UUID, SHA-256 hash stored only)
6. Mobile app displays a dynamic QR code for that specific offer
7. Retailer opens the unified scanner — no mode selection required
8. Retailer scans the QR once
9. Backend validates in a single call (`validate-qr-token`):
   - token type auto-detected (offer redemption or membership pass)
   - token exists and is not expired
   - token is not already used
   - consumer membership is still active at scan time
   - retailer has access to this offer
   - offer is still valid
   - offer rules still pass (re-checked at validation)
   - token marked consumed atomically
10. Backend records redemption result in `redemptions` table
11. Retailer sees a single clear result: **approved** (with benefit details) or **rejected** (reason + next available time if a rule cap was hit)
12. Consumer receives confirmation or failure on their screen

---

## Two QR Types — When to Use Each

### Offer Redemption QR (primary discount flow)
- Accessed from: offer detail screen → Redeem button
- Token issued by: `create-redemption-token`
- Contains: offer-specific token (single-use, 5-minute TTL)
- Validated by: `validate-qr-token` (offer path)
- Effect: redemption recorded, token consumed, benefit applied
- Use this for: all discount and offer claims

### Membership Pass QR (general identity proof)
- Accessed from: Card tab → membership card
- Token issued by: `create-membership-pass-token`
- Contains: membership-level token (reusable within TTL, 5-minute TTL)
- Validated by: `validate-qr-token` (pass path)
- Effect: confirms active membership, no redemption recorded
- Use this for: proving membership where no specific offer is being claimed

**Important:** do not design flows that ask a consumer to show their Card tab QR to redeem a specific
offer. The offer-specific QR is always the correct path. The membership pass is for general proof only.

---

## Security Rules

- do not trust client-side membership state
- do not trust client-side offer state
- tokens must be short-lived
- tokens must be single-use
- token validation must happen server-side
- all redemption attempts should be logged
- QR screenshots must not be reusable after expiry
- retailer user must only validate for their own retailer

---

## Required Tables

### redemption_tokens
Fields:
- id
- profile_id
- offer_id
- retailer_id
- retailer_location_id
- token_hash
- expires_at
- consumed_at
- created_at

### redemptions
Fields:
- id
- profile_id
- retailer_id
- retailer_location_id
- offer_id
- redemption_token_id
- status
- rejection_reason
- validated_by_profile_id
- redeemed_at
- created_at

Status values:
- success
- rejected
- expired
- rule_blocked
- membership_invalid

---

## Offer Rule Validation
Validation must support:
- one per user
- one per day
- max redemptions total
- valid day/time windows
- expired offer
- paused/non-live offer

---

## Backend Responsibilities

Implement secure backend logic for:

### create_redemption_token
Input:
- authenticated consumer
- offer_id

Checks:
- membership active
- offer live
- retailer visible
- offer rules currently valid

Output:
- short-lived token
- expiry timestamp

### validate_qr_token  (unified — handles all QR types)

> **Implementation status:** Complete.
> Edge function: `supabase/functions/validate-qr-token/`
> Membership pass path: ✅ complete.
> Offer redemption path: ✅ complete.

Input:
- scanned token (raw UUID)
- authenticated retailer user JWT

Token type detection:
- hash the token; check `membership_pass_tokens` first, then `redemption_tokens`
- type is determined server-side; the scanner does not need to know in advance

**Checks — offer redemption path (all implemented):**
- ✅ verify `redemptionToken.retailer_id === caller's retailer_id`
- ✅ token not expired
- ✅ token not already consumed
- ✅ re-verify consumer membership is still active at scan time
- ✅ re-verify offer is still live (`status = 'live'`, within `start_at`/`end_at`)
- ✅ re-validate offer rules at scan time: per-user cap, per-day cap, global cap, cooldown, valid days, valid time window

**Effects — offer redemption path:**
- ✅ mark token consumed atomically (`UPDATE WHERE consumed_at IS NULL` + `.select()` for race detection)
- ✅ insert row into `redemptions` table (`status = 'success'` or rejection reason)
- ✅ return structured result including `offer_title`, `benefit_text`, `next_available_at` for cap blocks
- ⚠️ **Launch blocker:** consume and insert are sequential, not transactional. If the insert fails after a successful consume, the scan returns `valid: false, status: "server_error"` and logs all IDs for manual reconciliation. Before production launch, implement a `redeem_offer_token(token_hash, retailer_user_id)` Postgres function that performs both operations in one transaction, replacing steps 7–8.

**Return — offer redemption (approved):**
`{ token_type: "redemption", valid: true, status: "success", offer_id, retailer_id, offer_title, benefit_text }`

**Return — offer redemption (rejected):**
`{ token_type: "redemption", valid: false, status: "expired"|"rejected"|"membership_invalid"|"rule_blocked", rejection_reason: string, next_available_at?: string }`

---

**Checks — membership pass path:** ✅ complete
- token not expired (no consumed_at — pass tokens are reusable within TTL)
- consumer membership still active at scan time

**Effects — membership pass:** ✅ complete
- no state change (token not consumed)
- return `{ token_type: "membership_pass", valid: true, plan_interval, member_since }`

---

Retailer result display:
- **Approved:** benefit to apply (e.g. "10% off total bill") or membership confirmed
- **Rejected:** clear reason (expired, already used, rule blocked, wrong retailer) + next available time for cap-based rejections

---

## Flutter Mobile App Responsibilities

Implement:

### Offer Detail
- redeem CTA

### Redemption UI
- request token from backend
- display QR code
- show expiry timer
- allow refresh if token expires

### Result Screens
- redemption success screen
- redemption failed screen

Do not validate redemption locally beyond basic UX state.

---

## Retailer Portal Responsibilities

Implement:

### QR Scanner Page
- use browser camera (no mode selection, no staff configuration required)
- scan QR code
- send raw token to `validate-qr-token` — backend determines type automatically
- display result without requiring retailer to know which QR type was scanned

### Result Handling — Offer Redemption
Show clearly:
- **Approved** — offer title, benefit to apply (e.g. "10% off"), member plan tier
- **Rejected: expired** — QR has expired, ask member to refresh
- **Rejected: already used** — this QR was already scanned
- **Rejected: membership invalid** — member's subscription is not active
- **Rejected: rule blocked** — per-user or per-day cap hit, show next available time if applicable
- **Rejected: offer not valid** — offer is paused, expired, or not for this retailer

### Result Handling — Membership Pass
Show:
- **Confirmed** — active BOL member, plan tier, member since date
- **Not active** — membership has lapsed

---

## Audit / Logging
Log:
- token creation
- token validation attempts
- success/failure outcomes
- retailer user performing validation

---

## Constraints
- do not implement loyalty points yet
- do not implement referral logic yet
- do not add unnecessary complexity
- keep the implementation modular and auditable

---

## Acceptance Criteria

Consumer:
- can tap redeem on a valid offer
- sees dynamic QR code
- cannot use expired token successfully

Retailer:
- can scan QR in portal
- receives clear success/failure response
- cannot validate for another retailer

Backend:
- enforces membership validity
- enforces single-use token
- logs redemption results
- rejects expired or invalid tokens
