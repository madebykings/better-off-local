# Better Off Local – Implementation Brief 06
# Admin Moderation and Approvals Workflow

## Objective
Implement the first proper admin moderation workflow for Better Off Local.

Admins must be able to review and manage:
- retailer approvals
- offer approvals
- retailer visibility
- offer visibility
- basic moderation actions
- audit trail of admin decisions

This slice is about operational control and launch readiness.

---

## Admin Responsibilities

Admins need to be able to:

### Retailers
- view pending retailers
- approve retailer
- reject retailer
- suspend retailer
- hide retailer from public discovery

### Offers
- view pending offers
- approve offer
- reject offer
- pause/hide live offer

### Visibility Control
Admins must be able to ensure only approved and valid retailers/offers appear publicly.

---

## Retailer Approval Rules

A retailer can be publicly visible only if:
- retailer is active
- approval_status = approved
- visibility_status = live
- retailer subscription is active
- at least one active location exists

Approval statuses:
- pending
- approved
- rejected
- suspended

Visibility statuses:
- draft
- live
- hidden

---

## Offer Approval Rules

An offer can be publicly visible only if:
- offer status = live
- retailer is publicly visible
- current date is within valid offer range
- retailer subscription is active

Offer statuses:
- draft
- pending
- approved
- live
- expired
- rejected
- paused

Recommended flow:
- retailer creates offer
- offer enters pending state
- admin approves
- approved offer becomes live if other conditions pass

---

## Admin Portal Scope

Implement or improve these pages:

### Retailer Approvals Page
Show:
- pending retailers
- retailer name
- subscription state
- location count
- submitted details
- approve/reject actions

### Offer Approvals Page
Show:
- pending offers
- retailer name
- offer title
- offer date range
- submitted terms
- approve/reject actions

### Retailers Management Page
Show:
- all retailers
- status badges
- approval state
- visibility state
- search/filter
- suspend/hide actions

### Offers Management Page
Show:
- all offers
- status badges
- retailer link
- search/filter
- pause/hide/reject actions

### Audit Log Page
Show:
- admin actions
- actor
- action type
- target
- reason if provided
- timestamp

---

## Backend Responsibilities

Implement secure admin actions for:

### Retailers
- approve retailer
- reject retailer
- suspend retailer
- set visibility status

### Offers
- approve offer
- reject offer
- pause offer
- set visibility-related status transitions correctly

### Audit
Every admin moderation action must be recorded.

Use or create:

### admin_actions
Fields:
- id
- admin_profile_id
- action_type
- target_table
- target_id
- reason
- metadata_json
- created_at

### audit_events
Fields:
- id
- actor_profile_id
- event_type
- target_table
- target_id
- metadata_json
- created_at

---

## Security Rules

- admin actions must be server-validated
- only admin users can perform moderation actions
- retailer users must not be able to call admin approval actions
- admin UI must not be the only enforcement layer
- public discovery queries must respect approval and visibility rules

---

## Query/View Expectations

Prefer reusable query helpers or SQL views for:
- public live retailers
- public live offers
- pending retailers
- pending offers

This reduces duplicated filtering logic.

---

## UI Guidance

Keep UI practical and operational:
- table/list views
- filters
- status badges
- clear action buttons
- confirm dialogs for destructive actions
- empty states for no pending approvals

Do not over-design this slice.

---

## Constraints
- do not implement advanced support ticketing yet
- do not implement retailer messaging/chat yet
- do not build a full CMS
- keep moderation actions simple, safe, and auditable

---

## Acceptance Criteria

Admin:
- can view pending retailers
- can approve/reject/suspend retailers
- can view pending offers
- can approve/reject/pause offers
- can view audit trail

Backend:
- only admins can perform moderation actions
- public queries only show valid visible retailers/offers
- moderation actions are logged

Consumer/Retailer impact:
- only approved live content appears publicly
- hidden/rejected/suspended content does not leak into discovery
