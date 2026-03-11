# Better Off Local – Data Model

## Overview
This document defines the core entities and relationships for Better Off Local.

The schema should support:
- consumers
- retailers
- admins
- subscriptions
- location-aware discovery
- offers and offer rules
- secure redemptions
- analytics and auditing

## Core Design Principles
- use UUID primary keys
- store timestamps on all important records
- keep billing state synchronized but not solely dependent on client logic
- separate profile identity from subscription/entitlement state
- make approval and publication states explicit
- audit important actions

---

## 1. profiles
Represents all platform users.

### Fields
- id
- role (`consumer`, `retailer_user`, `admin`)
- full_name
- email
- phone
- avatar_url
- is_active
- created_at
- updated_at

### Notes
- linked to Supabase auth user
- one profile per auth user

---

## 2. consumer_memberships
Represents consumer subscription state.

### Fields
- id
- profile_id
- stripe_customer_id
- stripe_subscription_id
- plan_interval (`monthly`, `annual`)
- status (`inactive`, `trialing`, `active`, `past_due`, `cancelled`, `expired`)
- current_period_start
- current_period_end
- cancel_at_period_end
- started_at
- ended_at
- created_at
- updated_at

### Notes
- active membership is required for redemption
- historical records may be preserved if plan changes are tracked separately

---

## 3. retailers
Represents a business entity.

### Fields
- id
- name
- slug
- description
- short_description
- logo_url
- cover_image_url
- website_url
- phone
- email
- is_active
- approval_status (`pending`, `approved`, `rejected`, `suspended`)
- visibility_status (`draft`, `live`, `hidden`)
- created_at
- updated_at

### Notes
- a retailer can have multiple retailer users
- a retailer may eventually support multiple locations

---

## 4. retailer_users
Links platform users to retailers.

### Fields
- id
- retailer_id
- profile_id
- access_role (`owner`, `manager`, `staff`)
- is_active
- created_at
- updated_at

### Notes
- allows multiple staff to access one retailer account
- scanning permissions may later vary by access role

---

## 5. retailer_subscriptions
Represents retailer billing and entitlement.

### Fields
- id
- retailer_id
- stripe_customer_id
- stripe_subscription_id
- billing_interval (`annual`)
- status (`inactive`, `active`, `past_due`, `cancelled`, `expired`)
- current_period_start
- current_period_end
- cancel_at_period_end
- started_at
- ended_at
- created_at
- updated_at

### Notes
- retailer must have active plan to be publicly visible

---

## 6. retailer_locations
Represents physical business locations.

### Fields
- id
- retailer_id
- name
- address_line_1
- address_line_2
- town
- county
- postcode
- country
- latitude
- longitude
- google_place_id
- is_primary
- is_active
- opening_hours_json
- created_at
- updated_at

### Notes
- location is used for nearby discovery and map display
- launch focus is Clackmannanshire but schema should support future expansion

---

## 7. categories
Represents retailer and offer categories.

### Fields
- id
- name
- slug
- icon
- sort_order
- is_active
- created_at
- updated_at

---

## 8. retailer_categories
Join table linking retailers to categories.

### Fields
- id
- retailer_id
- category_id
- created_at

---

## 9. offers
Represents a consumer-facing deal.

### Fields
- id
- retailer_id
- retailer_location_id
- title
- short_summary
- description
- offer_type (`percentage_discount`, `fixed_discount`, `free_item`, `bundle`, `other`)
- value_text
- terms_text
- start_at
- end_at
- status (`draft`, `pending`, `approved`, `live`, `expired`, `rejected`, `paused`)
- approval_required
- is_featured
- image_url
- created_by_profile_id
- created_at
- updated_at

### Notes
- offers may belong to a specific location or all locations later if needed

---

## 10. offer_rules
Represents structured redemption constraints.

### Fields
- id
- offer_id
- max_redemptions_total
- max_redemptions_per_user
- max_redemptions_per_day
- cooldown_hours
- valid_days_json
- valid_time_start
- valid_time_end
- new_customers_only
- requires_location_presence
- created_at
- updated_at

### Notes
- keeps offer logic flexible without bloating the offers table

---

## 11. favourites
Represents consumer saved retailers or offers.

### Fields
- id
- profile_id
- retailer_id
- offer_id
- created_at

### Notes
- one of retailer_id or offer_id may be used depending on feature implementation

---

## 12. redemption_tokens
Short-lived tokens used to generate secure QR codes.

### Fields
- id
- profile_id
- offer_id
- retailer_id
- retailer_location_id
- token_hash
- expires_at
- consumed_at
- created_at

### Notes
- do not store raw token if avoidable
- token generation and validation should happen server-side

---

## 13. redemptions
Represents completed or attempted redemption events.

### Fields
- id
- profile_id
- retailer_id
- retailer_location_id
- offer_id
- redemption_token_id
- status (`success`, `rejected`, `expired`, `rule_blocked`, `membership_invalid`)
- rejection_reason
- validated_by_profile_id
- redeemed_at
- created_at

### Notes
- every attempt may be worth logging, not just successes
- supports fraud monitoring and analytics

---

## 14. offer_views
Represents consumer views for analytics.

### Fields
- id
- profile_id
- offer_id
- retailer_id
- viewed_at

### Notes
- may later be sampled or aggregated for scale

---

## 15. notifications
Represents system or marketing notifications.

### Fields
- id
- profile_id
- type
- title
- body
- data_json
- sent_at
- read_at
- created_at

---

## 16. admin_actions
Represents internal moderation and admin decisions.

### Fields
- id
- admin_profile_id
- action_type
- target_table
- target_id
- reason
- metadata_json
- created_at
