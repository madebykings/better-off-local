# Better Off Local – Implementation Brief 07
# Notifications and Retention Basics

## Objective
Implement the first retention layer for Better Off Local.

This slice should help bring users back into the app and keep them engaged with local offers.

Focus on:
- in-app notifications
- push notification foundations
- notification preferences
- simple retention hooks tied to offers, favourites, and membership state

Do not overcomplicate this phase.

---

## Consumer Goals

Consumers should be able to:
- receive in-app notifications
- receive push notifications if enabled
- control basic notification preferences
- see useful reminders about nearby offers and membership status

---

## Notification Types

Implement support for at least these types:

### Offer Notifications
- new nearby offer
- favourite retailer added a new offer
- featured local offer

### Membership Notifications
- membership renewed
- payment failed
- membership expiring / at risk

### Redemption Notifications
- redemption successful
- redemption failed

---

## Data Model

Use or complete:

### notifications
Fields:
- id
- profile_id
- type
- title
- body
- data_json
- sent_at
- read_at
- created_at

Add any missing indexes if needed.

---

## Consumer App Scope

Implement or improve:

### Notifications Screen
Show:
- list of notifications
- read/unread state
- notification title
- body
- timestamp

### Notification Preferences in Settings
Allow user to control:
- marketing / offers notifications
- favourite retailer notifications
- membership/billing notifications

### App Behaviour
- unread badge/count support if practical
- tapping a notification can route to relevant screen if data exists
- mark as read when opened

---

## Push Foundations

Implement the basic push-ready structure, even if full campaigns are not built yet.

Requirements:
- store device push token if app architecture supports it
- support backend-triggered notification creation
- prepare clean abstraction for future push provider integration

Do not overbuild campaign tooling yet.

---

## Backend Responsibilities

Implement:
- notification creation helpers
- query for current user's notifications
- mark notification as read
- mark all as read if useful
- hooks/helpers for creating notifications after important events

At minimum, create notifications for:
- successful redemption
- failed redemption
- membership payment failure
- membership renewed/activated

---

## Retailer / Admin Scope

Minimal only.

Retailer/admin portals do not need full notification centers yet.
Only add shared backend support if necessary.

---

## Constraints
- do not build advanced marketing automation yet
- do not build scheduled campaign system yet
- do not build referral notifications yet
- keep implementation modular
- keep user controls simple and clear

---

## Acceptance Criteria

Consumer:
- can open notifications screen
- can see notifications
- can mark notifications as read
- can control preferences in settings

Backend:
- can create notifications for key events
- notifications are scoped to the correct user
- read/unread state is persisted

System:
- push foundation is prepared for later expansion
