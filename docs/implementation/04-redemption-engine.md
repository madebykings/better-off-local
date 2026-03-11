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

1. Consumer opens an offer in the mobile app
2. Consumer taps Redeem
3. Backend checks:
   - authenticated user
   - active membership
   - live retailer
   - live offer
   - offer rules allow redemption
4. Backend generates a short-lived redemption token
5. Mobile app displays a dynamic QR code based on that token
6. Retailer scans the QR code in the retailer portal
7. Backend validates:
   - token exists
   - token is not expired
   - token is not already used
   - consumer membership is still active
   - retailer has access
   - offer is still valid
   - offer rules still allow redemption
8. Backend records redemption result
9. Retailer sees success or failure
10. Consumer sees confirmation or failure

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

### validate_redemption
Input:
- scanned token
- authenticated retailer user

Checks:
- token valid
- token not expired
- token not consumed
- retailer user linked to correct retailer
- membership still active
- offer still valid
- offer rules still pass

Effects:
- mark token consumed
- create redemption record
- return success/failure result

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
- use browser camera
- scan QR code
- send token to backend validation endpoint
- display result

### Result Handling
Show:
- success
- failed
- expired
- already used
- membership invalid
- rule blocked

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
