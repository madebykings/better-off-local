# Better Off Local — Product Direction

## Vision

Better Off Local is not simply a discount app.

Better Off Local is a membership verification platform that connects local consumers with independent businesses through secure member-only benefits.

The platform exists to:

- Help consumers save money locally
- Increase footfall and revenue for local businesses
- Build stronger local communities
- Prevent discount abuse and code sharing
- Feel like a premium membership club rather than a coupon app

---

# Core Product Principles

1. Never expose reusable discount codes

2. Membership verification happens server-side

3. Retailer experience must be extremely simple

4. Consumer experience must feel premium

5. Support both in-store and online redemption

6. Mobile-first experience

7. Community over "cheap deals"

---

# Main User Types

## Consumer

Uses Better Off Local to:

- Discover nearby businesses
- View offers
- Save favourites
- Access digital membership pass
- Redeem offers
- Track savings

---

## Retailer Staff

Uses Better Off Local Retailer App to:

- Scan memberships
- Validate offers
- Confirm redemptions

Should require minimal training.

---

## Business Owner

Uses retailer portal to:

- Create offers
- View analytics
- View redemptions
- Manage staff
- Manage locations

---

## Admin

Uses internal portal to:

- Approve businesses
- Manage subscriptions
- Moderate offers
- View platform analytics

---

# Redemption Types

## In-Store Redemption

Consumer:

- Opens app
- Selects redeem
- Dynamic QR generated

Retailer app:

- Opens scanner
- Scans QR
- Backend validates:
    - membership active
    - retailer eligible
    - offer valid
    - usage limits

Returns:

ACTIVE MEMBER

or

INACTIVE MEMBER

Redemption logged.

---

## Online Redemption

Website:

Shows:

"Better Off Local Member Benefit Available"

Website generates:

- temporary verification session
- QR code

Consumer app:

- taps "Scan Online Checkout"
- scans website QR

Backend validates:

- membership active
- offer eligibility
- redemption rules

Website receives signed approval response

Website applies:

- discount
- free delivery
- bonus item
- member pricing

No visible discount code should ever appear.

---

# Integrations Strategy

MVP:

- WooCommerce connector
- Consumer app
- Retailer app
- Supabase backend

Future:

- Shopify app
- Universal JavaScript widget
- Wix support
- Squarespace support
- Webflow support

---

# Universal Widget Direction

Businesses should eventually be able to install:

<script src="https://cdn.betterofflocal.co.uk/widget.js"></script>

Widget responsibilities:

- Show member benefit messaging
- Generate QR sessions
- Handle verification flow
- Poll verification state
- Handle analytics

Platform connectors handle actual discount application.

---

# Design Direction

Design feeling:

- Premium
- Warm
- Local
- Community driven
- Modern
- Highly visual
- Trustworthy

Avoid:

- Coupon app aesthetics
- Loud colours
- Generic discount styling
- Corporate appearance

Reference products:

- Airbnb
- Revolut
- Too Good To Go
- Apple Wallet
- Uber Eats

---

# Home Screen Direction

Homepage should focus on:

- Nearby offers
- Trending local businesses
- Large imagery
- Categories
- Map access
- Savings indicators

Should feel like:

"Discovering local experiences"

Not:

"Browsing coupons"

---

# Retailer App Direction

Primary screen:

SCAN MEMBER PASS

Large camera view.

Minimal UI.

Fast validation.

Green success states.

Minimal taps.

---

# Technical Principles

- Supabase backend
- Secure signed tokens
- Short-lived QR sessions
- Row-level security
- Server-side validation
- API-first architecture
- No frontend trust

---

# Important

When implementing features:

Always ask:

"Does this feel like a premium local membership club?"

If the answer is no:

Reconsider implementation.