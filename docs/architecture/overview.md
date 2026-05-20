# Better Off Local – Architecture Overview

## Architecture Goals
The architecture must support:
- iOS and Android consumer apps from day one
- retailer self-service offer management
- internal admin moderation and oversight
- secure subscription-aware redemption
- location-based business and offer discovery
- future regional scaling

## Platform Components

### 1. Consumer Mobile App
Technology:
- Flutter

Purpose:
- consumer onboarding
- authentication
- subscription purchase and status
- nearby deals discovery
- map and list views
- offer details
- favourites
- digital membership card
- dynamic QR redemption
- account and notification management

### 2. Retailer Portal
Technology:
- Next.js

Purpose:
- retailer login
- retailer profile management
- business location management
- offer creation and editing
- pausing or archiving offers
- QR/member validation
- redemption history
- analytics and performance summaries

### 3. Admin Portal
Technology:
- Next.js

Purpose:
- approve or reject retailers
- approve or reject offers
- manage featured placements
- monitor subscriptions
- review suspicious redemption activity
- manage rollout settings and categories
- view operational analytics

### 4. Backend
Technology:
- Supabase

Responsibilities:
- authentication
- Postgres database
- role-based access control via RLS
- storage for retailer assets
- edge functions for secure business logic
- realtime where useful
- audit logging
- subscription sync support

### 5. Billing
Technology:
- Stripe

Responsibilities:
- consumer recurring subscriptions
- retailer annual subscriptions
- webhook event processing
- plan status synchronization into platform access logic

### 6. Maps and Location
Technology:
- Google Maps / Places APIs

Responsibilities:
- nearby discovery
- map display
- directions handoff
- optional geocoding support

## User Roles

### Consumer
Can:
- view eligible public content
- manage own account
- redeem offers if membership is active

### Retailer User
Can:
- manage own retailer profile and offers
- validate member redemptions
- view own analytics

### Admin
Can:
- manage approval workflows
- view cross-platform data
- moderate listings, offers, and suspicious usage
- configure operational settings

## Core Functional Modules

### Auth and Identity
Handles:
- sign up / sign in
- consumer and retailer account creation
- role assignment
- profile linking

### Subscription and Entitlement
Handles:
- active consumer membership state
- active retailer plan state
- feature gating based on plan status
- billing event synchronization

### Retailer Profiles
Handles:
- retailer details
- branding assets
- category assignment
- public listing configuration
- location setup

### Offers
Handles:
- creation, editing, approval, publication, expiry
- offer rules and restrictions
- scheduled start/end dates
- display eligibility

### Discovery
Handles:
- nearby offers
- map pins
- list sorting
- category filters
- featured placements

### Redemption
Handles:
- dynamic QR generation
- short-lived validation tokens
- retailer scan/verification
- rule enforcement
- server-side redemption logging

### Analytics
Handles:
- views
- favourites
- redemption counts
- basic retailer performance summaries
- operational admin metrics

### Notifications
Handles:
- consumer push notifications
- offer reminders
- nearby relevant alerts
- operational system messages

## High-Level Flow

### Consumer Discovery Flow
1. User opens app
2. App checks membership entitlement
3. App loads nearby retailers and offers
4. User views details and chooses an offer
5. User redeems if eligible

### Redemption Flow (In-Store Offer)
1. Consumer browses offers and selects a specific one
2. Offer detail screen shows live availability state: eligible, already redeemed today, rule blocked, etc.
3. Consumer taps Redeem — app calls `create-redemption-token` for that specific offer
4. Backend validates at token creation: active membership, live offer, retailer active, all offer rules
5. App displays a dynamic, short-lived QR code for that offer
6. Retailer opens the unified scanner — no mode selection required
7. Retailer scans the QR once
8. Backend validates in a single call via `validate-qr-token`: token type detected automatically, expiry checked, membership re-verified, offer rules re-checked, redemption recorded
9. Retailer sees one clear result: approved (benefit to apply) or rejected (reason, next available time if relevant)
10. Consumer receives confirmation on their screen

### Membership Pass (Identity Proof — Separate from Discount Flow)
The Card tab QR issues a short-lived membership-level token (`create-membership-pass-token`). This proves
active BOL membership but is **not** the primary discount flow.

Use cases: general membership proof at a retailer, entry verification, any non-offer check.
The unified scanner (`validate-qr-token`) handles both QR types automatically — no staff mode switching.

Do not ask consumers to show their Card tab QR to redeem a specific offer. The correct flow is
always: offer detail → Redeem → offer-specific QR → retailer scans once.

### Retailer Offer Flow
1. Retailer logs into portal
2. Retailer creates or edits offer
3. Offer enters pending or active state depending on approval rules
4. Approved offer appears in the consumer app if retailer plan is active

## Environment Strategy
Use separate environments for:
- local development
- staging
- production

Never mix production secrets into development workflows.

## Security Principles
- server-side validation for redemption
- role-based access via RLS
- short-lived QR payloads
- no client-side trust for entitlement checks
- audit logging for critical actions
- webhook signature validation for Stripe events

## Scalability Principles
The system should launch hyper-local but support future:
- multi-region rollout
- many retailers per region
- many offers per retailer
- more advanced loyalty mechanics
- referral systems
- premium placements
