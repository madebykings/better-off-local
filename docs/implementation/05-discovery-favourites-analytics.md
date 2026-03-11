# Better Off Local – Implementation Brief 05
# Discovery, Favourites, and Analytics Basics

## Objective
Improve the consumer discovery experience and add the first meaningful retailer-facing analytics.

This slice should make the app feel useful day to day:
- nearby offers
- retailer browsing
- favourites
- simple view/save/redemption metrics

---

## Consumer App Scope

Implement or improve:

### Home Screen
Show:
- nearby offers
- featured retailers
- category shortcuts
- clear empty states if no local offers exist

### Explore / Offers List
Support:
- list of live offers
- sort by distance
- filter by category
- filter by featured/new if available

### Map Screen
Support:
- live retailer/offer pins
- tap pin to open preview card
- link through to offer or retailer detail

### Offer Detail Screen
Show:
- retailer name
- offer details
- terms
- validity
- location
- favourite/save action
- redeem CTA if eligible

### Retailer Detail Screen
Show:
- retailer profile
- active offers
- address/location
- contact details if available

### Favourites Screen
Users can:
- save offers
- unsave offers
- save retailers
- unsave retailers
- view all saved items

---

## Data Rules

Only show offers that are:
- live
- within start/end dates
- attached to visible retailers
- linked to active retailer subscriptions

Only show retailers that are:
- active
- approved
- live
- have active retailer subscription

---

## Favourites

Use existing or create:

### favourites
Fields:
- id
- profile_id
- retailer_id (nullable)
- offer_id (nullable)
- created_at

Rules:
- a favourite must reference either a retailer or an offer
- users can only manage their own favourites

---

## Analytics Basics

Implement first-pass tracking for:

### offer_views
Track when a consumer opens an offer detail screen.

Fields:
- id
- profile_id (nullable if needed later)
- offer_id
- retailer_id
- viewed_at

### Favourites Count
Retailers should be able to see how many times their offers or business were saved.

### Redemption Counts
Retailers should see total successful redemptions.

---

## Retailer Portal Scope

Add or improve:

### Dashboard
Show basic metrics:
- live offers count
- total successful redemptions
- total offer views
- total favourites/saves
- recent redemption activity

### Offer Analytics
Per-offer view should show:
- views
- saves
- successful redemptions

Use simple aggregated queries.
Do not overengineer charts yet.

---

## Backend Responsibilities

Implement:
- public live offers query path
- public live retailers query path
- favourite toggle logic
- offer view logging
- retailer dashboard aggregation queries

Prefer reusable query helpers or views where sensible.

---

## Constraints
- do not implement advanced recommendations yet
- do not implement push notification campaigns yet
- do not implement loyalty/cashback yet
- keep analytics simple and accurate
- keep discovery queries modular and efficient

---

## Acceptance Criteria

Consumer:
- can browse nearby live offers
- can filter by category
- can favourite offers and retailers
- can view favourites list
- can open retailer and offer details cleanly

Retailer:
- can see basic dashboard metrics
- can see offer-level views/saves/redemptions

Backend:
- only eligible live data is exposed
- favourites are user-scoped
- offer views are logged
