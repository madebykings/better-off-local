# Better Off Local – Module Breakdown

## Overview
This document defines the core product and technical modules for Better Off Local.

The purpose is to:
- keep responsibilities clear
- improve implementation sequencing
- help AI coding tools work in bounded areas
- reduce architecture drift

---

# 1. Authentication Module

## Purpose
Manage authentication, session handling, password recovery, and identity bootstrap.

## Responsibilities
- sign up
- sign in
- password reset
- session refresh
- auth state bootstrap
- role resolution

## Main Actors
- consumer
- retailer user
- admin

## Dependencies
- Supabase Auth
- profiles table

## Notes
- auth does not decide entitlements alone
- role is resolved after authentication

---

# 2. Profiles and Roles Module

## Purpose
Manage platform user identity and role-linked access.

## Responsibilities
- create and update profile records
- assign role types
- link retailer users to retailers
- activate / deactivate users

## Tables
- profiles
- retailer_users

## Dependencies
- authentication module
- RLS policies

---

# 3. Consumer Memberships Module

## Purpose
Control whether a consumer has active entitlement to use paid member features.

## Responsibilities
- store membership records
- track plan interval
- expose active/inactive state
- sync Stripe events
- support renewal/cancellation logic

## Tables
- consumer_memberships

## Dependencies
- Stripe
- profiles
- paywall flows

## Notes
- active membership is required for redemption
- app should never trust only local state

---

# 4. Retailer Subscription Module

## Purpose
Control whether a retailer can be publicly visible and use portal features.

## Responsibilities
- track retailer annual plan state
- gate public listing visibility
- gate offer publishing
- sync Stripe state

## Tables
- retailer_subscriptions

## Dependencies
- retailers
- Stripe

---

# 5. Retailer Management Module

## Purpose
Manage retailer entities and their public presence.

## Responsibilities
- retailer profile management
- category assignment
- contact details
- brand assets
- visibility and approval state

## Tables
- retailers
- retailer_categories
- categories

## Dependencies
- retailer users
- retailer subscriptions
- admin moderation

---

# 6. Retailer Locations Module

## Purpose
Manage physical retailer locations for discovery and redemption context.

## Responsibilities
- create and update locations
- map coordinates
- opening hours
- primary location handling
- location activity state

## Tables
- retailer_locations

## Dependencies
- retailers
- maps/geocoding
- discovery module

---

# 7. Offers Module

## Purpose
Manage the lifecycle of retailer offers.

## Responsibilities
- create offers
- edit offers
- pause offers
- submit offers for approval
- publish offers
- expire offers

## Tables
- offers

## Dependencies
- retailers
- locations
- retailer subscription state
- admin moderation

---

# 8. Offer Rules Module

## Purpose
Define structured business rules governing redemption eligibility.

## Responsibilities
- per-user redemption caps
- per-day limits
- date/time windows
- day-of-week restrictions
- cooldown logic
- location presence requirements

## Tables
- offer_rules

## Dependencies
- offers
- redemption validation module

---

# 9. Discovery Module

## Purpose
Power nearby browsing and consumer search experience.

## Responsibilities
- nearby offers query
- nearby retailers query
- distance sorting
- category filters
- featured ordering
- list and map data shaping

## Tables
- retailers
- retailer_locations
- offers
- categories

## Dependencies
- maps/location services
- offer visibility rules
- retailer visibility rules

## Notes
- this is a critical product-value module

---

# 10. Favourites Module

## Purpose
Allow consumers to save retailers and offers.

## Responsibilities
- save / unsave actions
- list favourites
- support future notifications or reminders

## Tables
- favourites

## Dependencies
- profiles
- offers
- retailers

---

# 11. Redemption Token Module

## Purpose
Generate and manage short-lived redemption tokens for QR validation.

## Responsibilities
- issue server-side token
- tie token to user and offer context
- set expiry
- prevent reuse
- mark consumed state

## Tables
- redemption_tokens

## Dependencies
- consumer memberships
- offers
- offer rules
- retailers
- retailer locations

## Notes
- token should never be trusted unless validated server-side

---

# 12. Redemption Validation Module

## Purpose
Validate and record redemption attempts.

## Responsibilities
- validate token
- validate consumer entitlement
- validate retailer access
- validate offer state
- validate offer rules
- log outcome
- return safe success/failure result

## Tables
- redemptions
- redemption_tokens

## Dependencies
- memberships
- offers
- offer rules
- retailer users
- audit events

## Notes
- one of the highest-risk modules in the platform

---

# 13. Notifications Module

## Purpose
Send relevant updates to consumers and operational messages to users.

## Responsibilities
- store notifications
- mark read/unread
- push local deal alerts
- push membership/billing alerts
- push admin/retailer operational messages later if needed

## Tables
- notifications

## Dependencies
- profiles
- device token handling
- future push provider integration

---

# 14. Analytics Module

## Purpose
Provide measurable value to retailers and operational insight to admins.

## Responsibilities
- offer views
- redemption counts
- favourites count
- recent activity summaries
- retailer dashboard metrics
- admin top-line metrics

## Tables
- offer_views
- redemptions
- favourites
- possibly future aggregate tables

## Dependencies
- offers
- retailers
- consumers

---

# 15. Admin Moderation Module

## Purpose
Provide operational control over platform content and trust.

## Responsibilities
- approve or reject retailers
- approve or reject offers
- suspend retailers
- hide offers
- review suspicious redemptions
- capture admin reasons

## Tables
- admin_actions
- retailers
- offers

## Dependencies
- audit events
- role checks

---

# 16. Audit and Compliance Module

## Purpose
Track important actions and support operational traceability.

## Responsibilities
- record system events
- record actor, target, and metadata
- support fraud analysis
- support internal debugging

## Tables
- audit_events
- admin_actions

## Dependencies
- all critical modules

---

# 17. Billing Integration Module

## Purpose
Synchronize Stripe billing state with platform access rules.

## Responsibilities
- webhook handling
- create/update subscription records
- process renewals/cancellations/failures
- maintain entitlement source of truth

## Dependencies
- Stripe
- consumer memberships
- retailer subscriptions
- audit logging

## Notes
- should live mostly in backend functions, not client apps

---

# 18. Geolocation Module

## Purpose
Provide location-aware user experiences.

## Responsibilities
- resolve current user location
- calculate nearby results
- support map pinning
- optionally enforce proximity during redemption

## Dependencies
- retailer_locations
- maps APIs
- mobile location permissions

---

# 19. Support and Operations Module

## Purpose
Provide internal tools and support workflows.

## Responsibilities
- member lookup
- retailer lookup
- redemption troubleshooting
- subscription troubleshooting
- issue notes later if needed

## Dependencies
- admin portal
- audit trails
- billing state

---

# Recommended First Build Order
1. authentication
2. profiles and roles
3. consumer memberships
4. retailer subscriptions
5. retailer management
6. retailer locations
7. offers
8. offer rules
9. discovery
10. redemption tokens
11. redemption validation
12. analytics
13. notifications
14. admin moderation
15. audit and compliance
