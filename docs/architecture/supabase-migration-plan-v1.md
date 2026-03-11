# Better Off Local – Supabase Migration Plan v1

## Objective
This document defines the first structured Supabase schema migration plan for Better Off Local.

The goal of v1 is to create the minimum strong backend foundation for:
- authentication-linked profiles
- retailers and retailer users
- retailer locations
- categories
- offers
- offer rules
- consumer memberships
- retailer subscriptions
- favourites
- redemption tokens
- redemptions
- notifications
- admin actions
- audit events

This plan is intentionally backend-first so app and portal work can proceed against stable data structures.

---

# Migration Strategy

## Principles
- use UUID primary keys
- use `gen_random_uuid()`
- use `timestamptz`
- include `created_at` and `updated_at` where relevant
- add explicit check constraints and enums where useful
- keep derived business logic out of clients
- enable RLS on all application tables
- use triggers for `updated_at`

---

# Recommended Migration File Order

## 001_extensions.sql
### Purpose
Enable required PostgreSQL extensions.

### Includes
- pgcrypto
- postgis (optional now, recommended later if geospatial search gets more advanced)

### Notes
If PostGIS is not enabled initially, latitude/longitude can still be stored as numeric columns.

---

## 002_profiles.sql
### Purpose
Create profiles table linked to auth users.

### Tables
- profiles

### Includes
- role check constraint or enum: `consumer`, `retailer_user`, `admin`
- active state
- full name
- email
- phone
- avatar_url

### Extras
- trigger function for `updated_at`
- optional trigger to create profile row on auth signup later

---

## 003_categories.sql
### Purpose
Create category structure.

### Tables
- categories

### Seed Suggestions
- Cafes
- Restaurants
- Bars
- Beauty
- Fitness
- Shopping
- Services

---

## 004_retailers.sql
### Purpose
Create retailer core entity and retailer-user linking.

### Tables
- retailers
- retailer_users
- retailer_categories

### Includes
- approval_status
- visibility_status
- business metadata
- owner/manager/staff access role on retailer_users

---

## 005_retailer_locations.sql
### Purpose
Create physical business locations.

### Tables
- retailer_locations

### Includes
- address fields
- latitude
- longitude
- county field for regional segmentation
- opening_hours_json

### Notes
Set county as plain text initially. Can normalize later if needed.

---

## 006_consumer_memberships.sql
### Purpose
Create consumer membership records.

### Tables
- consumer_memberships

### Includes
- Stripe identifiers
- status
- billing interval
- entitlement period dates
- cancel_at_period_end flag

---

## 007_retailer_subscriptions.sql
### Purpose
Create retailer subscription records.

### Tables
- retailer_subscriptions

### Includes
- annual plan state
- Stripe identifiers
- entitlement dates

---

## 008_offers.sql
### Purpose
Create offers.

### Tables
- offers

### Includes
- retailer relationship
- optional location relationship
- offer_type
- title
- description
- terms
- status
- date windows
- featured flag

---

## 009_offer_rules.sql
### Purpose
Create structured offer rules.

### Tables
- offer_rules

### Includes
- per-user cap
- per-day cap
- total cap
- cooldown
- valid day/time constraints
- requires_location_presence

---

## 010_favourites.sql
### Purpose
Create favourites storage.

### Tables
- favourites

### Notes
Prefer a constraint ensuring at least one of `retailer_id` or `offer_id` is set.

---

## 011_redemption_tokens.sql
### Purpose
Create short-lived redemption token storage.

### Tables
- redemption_tokens

### Includes
- profile
- offer
- retailer
- location
- token_hash
- expires_at
- consumed_at

### Notes
Do not store plaintext token if avoidable.

---

## 012_redemptions.sql
### Purpose
Create redemption result logging.

### Tables
- redemptions

### Includes
- success and failure status
- rejection_reason
- validating retailer user
- redemption timestamp

---

## 013_offer_views.sql
### Purpose
Create basic analytics tracking for offer views.

### Tables
- offer_views

---

## 014_notifications.sql
### Purpose
Create in-app notifications table.

### Tables
- notifications

---

## 015_admin_actions.sql
### Purpose
Create admin moderation history.

### Tables
- admin_actions

---

## 016_audit_events.sql
### Purpose
Create cross-cutting audit log.

### Tables
- audit_events

---

## 017_indexes.sql
### Purpose
Add performance indexes for common queries.

### Suggested Indexes
- profiles(role)
- consumer_memberships(profile_id, status)
- retailer_subscriptions(retailer_id, status)
- retailer_locations(retailer_id)
- offers(retailer_id, status)
- offers(start_at, end_at)
- offers(retailer_location_id)
- redemptions(profile_id, offer_id)
- redemptions(retailer_id, redeemed_at)
- redemption_tokens(expires_at)
- favourites(profile_id)

---

## 018_rls_policies.sql
### Purpose
Enable and define row-level security policies.

### Coverage
- profiles
- consumer_memberships
- retailers
- retailer_users
- retailer_locations
- offers
- offer_rules
- favourites
- redemption_tokens
- redemptions
- notifications
- admin_actions
- audit_events

### Notes
Start with safe baseline policies.
Complex policies can be expanded after app wiring begins.

---

## 019_views_and_helpers.sql
### Purpose
Create helper SQL views/functions for common business states.

### Candidate Views
- `public_live_retailers`
- `public_live_offers`
- `active_consumer_memberships`
- `active_retailer_subscriptions`

### Candidate Functions
- `is_profile_admin(profile_uuid)`
- `is_profile_linked_to_retailer(profile_uuid, retailer_uuid)`
- `consumer_membership_is_active(profile_uuid)`
- `retailer_subscription_is_active(retailer_uuid)`

### Notes
These helper functions will simplify RLS and app querying.

---

## 020_seed_reference_data.sql
### Purpose
Seed categories and initial local region defaults.

### Seed Suggestions
- initial categories
- Clackmannanshire as primary launch county marker in future regional table if introduced later

---

# First SQL Scope Recommendation

## Build First
For the first schema pass, Claude Code should implement:
1. extensions
2. profiles
3. categories
4. retailers
5. retailer_users
6. retailer_categories
7. retailer_locations
8. consumer_memberships
9. retailer_subscriptions
10. offers
11. offer_rules
12. favourites
13. redemption_tokens
14. redemptions
15. notifications
16. admin_actions
17. audit_events
18. indexes
19. baseline RLS
20. helper views/functions
21. seed data

---

# RLS Policy Strategy v1

## Profiles
- users can read/update their own profile
- admins can read all
- no one else can read private profile data broadly unless required

## Consumer Memberships
- consumers can read their own membership records
- admins can read all
- mutations should generally happen through backend functions/webhooks

## Retailers
- public can read only approved/live retailers through filtered policy or view
- retailer users can manage their linked retailers
- admins can manage all

## Retailer Users
- retailer-linked users can read their own retailer membership rows
- admins can read all

## Retailer Locations
- public can read only locations of live retailers
- retailer users can manage their own
- admins can manage all

## Offers
- public can read only live/eligible offers
- retailer users can manage their own offers
- admins can manage all

## Offer Rules
- readable alongside accessible offers
- writable by linked retailer users and admins

## Favourites
- users can manage only their own favourites

## Redemption Tokens
- consumers can create/request only for themselves through secure function flow
- read access should be tightly restricted
- token validation should happen through server-side function

## Redemptions
- consumers can read their own redemption history
- retailer users can read redemptions for their own retailers
- admins can read all
- inserts should happen through secure backend process

## Notifications
- users can read their own notifications
- system/backend inserts notifications

## Admin Actions / Audit Events
- admins read as needed
- direct writes controlled by backend/admin paths only

---

# Recommended Edge Functions After Schema
Once the initial schema is in place, the next backend functions should be:

1. `create_or_sync_profile`
2. `sync_stripe_consumer_membership`
3. `sync_stripe_retailer_subscription`
4. `create_redemption_token`
5. `validate_redemption`
6. `record_offer_view`
7. `admin_approve_retailer`
8. `admin_approve_offer`
