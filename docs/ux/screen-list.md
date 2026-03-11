# Better Off Local – Screen List

## Overview
This document defines the first-wave screens for Better Off Local across:
- consumer mobile app
- retailer portal
- admin portal

The goal is to keep scope production-grade but focused on launch readiness for Clackmannanshire.

---

# Consumer Mobile App (Flutter)

## 1. Splash / Launch Screen
### Purpose
- app boot
- branding
- auth/session check
- membership state bootstrap

### Notes
- should route quickly to the correct next state
- no heavy logic in UI layer

---

## 2. Welcome / Intro Screen
### Purpose
- explain what Better Off Local is
- show value proposition
- push users into sign up or sign in

### Key Content
- support local businesses
- save money nearby
- discover local deals in Clackmannanshire

---

## 3. Sign Up Screen
### Purpose
- create consumer account

### Fields
- full name
- email
- password
- optional phone

### Notes
- social login can be added later, not required for v1 launch

---

## 4. Sign In Screen
### Purpose
- existing user login

### Fields
- email
- password
- forgot password link

---

## 5. Forgot Password Screen
### Purpose
- password reset request

---

## 6. Subscription / Paywall Screen
### Purpose
- present monthly and annual consumer plans
- show value and savings angle
- trigger Stripe-backed app billing flow

### Key Content
- membership price
- annual saving if billed yearly
- examples of local savings
- active offers nearby count if available

---

## 7. Subscription Success Screen
### Purpose
- confirm plan activation
- move user into app experience

---

## 8. Home Screen
### Purpose
- main app dashboard
- show nearby offers and featured retailers

### Sections
- hero value message
- nearby offers
- featured local businesses
- categories
- savings summary
- callout for map view

### Notes
- this is the most important screen in the app

---

## 9. Offer Discovery List Screen
### Purpose
- browse offers in list format

### Features
- sort by distance
- filter by category
- filter by featured/new/expiring
- search by retailer or offer title

---

## 10. Map Screen
### Purpose
- discover offers visually by location

### Features
- map pins
- current location
- tappable retailer/offer cards
- open directions

---

## 11. Offer Detail Screen
### Purpose
- show full details for one offer

### Content
- retailer branding
- offer title
- description
- terms
- validity
- address
- opening hours
- redeem CTA
- save/favourite CTA

---

## 12. Retailer Detail Screen
### Purpose
- show retailer profile and all live offers

### Content
- logo / cover
- description
- location
- categories
- all active offers
- directions
- contact details

---

## 13. Categories Screen
### Purpose
- browse by category

### Example Categories
- cafes
- restaurants
- bars
- beauty
- fitness
- shopping
- services

---

## 14. Saved / Favourites Screen
### Purpose
- show saved offers and retailers

---

## 15. Membership Card Screen
### Purpose
- show active membership state
- render dynamic QR for redemption

### Content
- member name
- membership status
- renewal date
- QR payload view state
- refresh/expiry indicator

### Notes
- short-lived QR logic should be backed by server-issued redemption token flow

---

## 16. Redemption Confirmation Screen
### Purpose
- confirm successful redemption

### Content
- retailer name
- redeemed offer
- timestamp
- optional savings value

---

## 17. Redemption Failed Screen
### Purpose
- explain failure reason safely

### Possible Reasons
- inactive membership
- expired QR
- offer rule blocked
- retailer validation failed
- offer expired

---

## 18. Notifications Screen
### Purpose
- show in-app notifications and deal alerts

---

## 19. Account Screen
### Purpose
- user profile and account settings

### Features
- profile details
- membership plan/status
- payment management link
- saved amount summary
- logout

---

## 20. Settings Screen
### Purpose
- app settings and preferences

### Features
- push notification preferences
- location permissions info
- support
- legal links
- delete account request

---

## 21. Savings Screen
### Purpose
- show total consumer savings over time

### Metrics
- total saved
- this month saved
- recent redemptions

---

## 22. Redemption History Screen
### Purpose
- show past successful and failed redemption attempts

---

# Retailer Portal (Next.js)

## 1. Retailer Sign In Screen
### Purpose
- retailer user login

---

## 2. Retailer Password Reset Screen
### Purpose
- reset access

---

## 3. Retailer Dashboard Screen
### Purpose
- summary view for retailer

### Metrics
- live offers
- total redemptions
- recent redemptions
- profile completeness
- subscription status

---

## 4. Retailer Profile Screen
### Purpose
- manage public retailer profile

### Fields
- name
- description
- logo
- cover image
- contact details
- website
- categories

---

## 5. Retailer Locations Screen
### Purpose
- manage one or more store locations

### Features
- create location
- edit location
- set primary location
- opening hours

---

## 6. Offers List Screen
### Purpose
- list retailer offers

### Filters
- live
- pending
- paused
- expired
- rejected

---

## 7. Create Offer Screen
### Purpose
- create a new offer

### Fields
- title
- summary
- description
- offer type
- value text
- terms
- date range
- location
- rule settings

---

## 8. Edit Offer Screen
### Purpose
- update existing offer

---

## 9. Offer Analytics Screen
### Purpose
- view per-offer performance

### Metrics
- views
- saves
- redemptions
- rejection reasons
- recent activity

---

## 10. QR Scanner Screen
### Purpose
- scan consumer QR for redemption validation

### Notes
- can use device camera in browser
- final validation must happen server-side

---

## 11. Redemption Result Screen
### Purpose
- show success/failure after scan

---

## 12. Redemption History Screen
### Purpose
- show validation history

---

## 13. Subscription / Billing Screen
### Purpose
- show retailer plan status
- manage annual billing

---

## 14. Retailer Settings Screen
### Purpose
- access management and account settings

---

# Admin Portal (Next.js)

## 1. Admin Sign In Screen
### Purpose
- internal admin login

---

## 2. Admin Dashboard Screen
### Purpose
- top-level operational overview

### Metrics
- active members
- active retailers
- pending approvals
- recent redemptions
- subscription health
- flagged activity

---

## 3. Retailer Approval Queue Screen
### Purpose
- review retailer applications and profile changes

---

## 4. Offer Approval Queue Screen
### Purpose
- review submitted offers before publication

---

## 5. Retailers Management Screen
### Purpose
- search and manage retailers

---

## 6. Offers Management Screen
### Purpose
- search and manage offers

---

## 7. Members Management Screen
### Purpose
- search and inspect consumer accounts

---

## 8. Redemptions Monitoring Screen
### Purpose
- monitor redemption activity and suspicious patterns

---

## 9. Categories Management Screen
### Purpose
- manage platform taxonomy

---

## 10. Featured Content Screen
### Purpose
- control featured placements and merchandising

---

## 11. Subscription Monitoring Screen
### Purpose
- inspect consumer and retailer billing states

---

## 12. Audit Log Screen
### Purpose
- inspect admin and system actions

---

## 13. Admin Settings Screen
### Purpose
- internal operational settings

---

# Initial Launch Navigation Recommendations

## Consumer App Bottom Navigation
- Home
- Explore
- Map
- Card
- Account

## Retailer Portal Main Nav
- Dashboard
- Offers
- Scan
- Redemptions
- Profile
- Billing

## Admin Portal Main Nav
- Dashboard
- Retailers
- Offers
- Members
- Redemptions
- Settings
