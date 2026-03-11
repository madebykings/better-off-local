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

### Redemption Flow
1. Consumer opens redeem action
2. App requests a short-lived redemption token
3. Backend verifies user and membership status
4. App renders dynamic QR based on the token
5. Retailer scans the code
6. Backend validates token, retailer access, offer rules, and membership
7. Redemption is recorded server-side
8. Both parties receive success/failure response

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
