# Better Off Local – Next.js Portals Structure

## Overview
This document defines the recommended structure for the two Next.js web portals:
- retailer portal
- admin portal

The goals are:
- shared architectural consistency
- separate responsibilities
- strong maintainability
- easy AI-assisted implementation
- minimal duplication where sensible

Both portals should remain separate apps inside the monorepo.
They may share UI and types through `packages/`, but should not become one tangled dashboard app.

---

## Portals Covered

### Retailer Portal
Used by local businesses to:
- manage retailer profile
- manage locations
- create and edit offers
- view redemptions
- scan member QR codes
- view billing status
- access basic analytics

### Admin Portal
Used internally to:
- review retailers
- review offers
- monitor subscriptions
- inspect members
- monitor redemptions
- manage categories and featured content
- review audit history

---

## Recommended Framework Choices
- Next.js App Router
- TypeScript
- Tailwind CSS
- shadcn/ui for base components
- React Query or server actions for controlled data flows
- Supabase SSR/auth patterns where needed

---

## Shared Principles
- each portal is its own app
- shared components go in `packages/ui` only when genuinely reusable
- shared domain types go in `packages/types`
- do not couple retailer logic into admin-only modules
- keep server-side authorization strict
- all sensitive actions must be server-validated

---

## Monorepo Placement

```text
apps/
  admin/
  retailer-portal/

packages/
  ui/
  types/
  config/
```

---

## Retailer Portal Structure

### Recommended Folder Structure

```text
apps/retailer-portal/
├── app/
│   ├── (auth)/
│   │   ├── sign-in/
│   │   │   └── page.tsx
│   │   ├── forgot-password/
│   │   │   └── page.tsx
│   │   └── layout.tsx
│   │
│   ├── (dashboard)/
│   │   ├── dashboard/
│   │   │   └── page.tsx
│   │   ├── offers/
│   │   │   ├── page.tsx
│   │   │   ├── new/
│   │   │   │   └── page.tsx
│   │   │   └── [offerId]/
│   │   │       └── page.tsx
│   │   ├── locations/
│   │   │   └── page.tsx
│   │   ├── redemptions/
│   │   │   └── page.tsx
│   │   ├── scan/
│   │   │   └── page.tsx
│   │   ├── profile/
│   │   │   └── page.tsx
│   │   ├── billing/
│   │   │   └── page.tsx
│   │   ├── settings/
│   │   │   └── page.tsx
│   │   └── layout.tsx
│   │
│   ├── api/
│   │   └── internal/
│   │       └── ...
│   │
│   ├── layout.tsx
│   └── page.tsx
│
├── components/
│   ├── layout/
│   │   ├── retailer_sidebar.tsx
│   │   ├── retailer_header.tsx
│   │   └── retailer_shell.tsx
│   ├── offers/
│   ├── profile/
│   ├── locations/
│   ├── redemptions/
│   ├── scan/
│   └── shared/
│
├── features/
│   ├── auth/
│   ├── dashboard/
│   ├── offers/
│   ├── locations/
│   ├── profile/
│   ├── redemptions/
│   ├── scan/
│   ├── billing/
│   └── settings/
│
├── lib/
│   ├── auth/
│   │   ├── require_retailer_user.ts
│   │   └── get_current_retailer_context.ts
│   ├── supabase/
│   │   ├── client.ts
│   │   ├── server.ts
│   │   └── middleware.ts
│   ├── actions/
│   ├── queries/
│   ├── mappers/
│   ├── validators/
│   └── utils/
│
├── middleware.ts
├── types/
├── public/
└── README.md
```

---

## Retailer Portal Module Guidance

### Auth Module

Handles:
- sign in
- forgot password
- session enforcement
- retailer user access context

### Dashboard Module

Handles:
- top-line metrics
- profile completeness
- subscription health
- recent redemptions

### Offers Module

Handles:
- offer list
- create offer
- edit offer
- pause offer
- expiry visibility
- approval state messaging

### Locations Module

Handles:
- create/edit locations
- opening hours
- map/address fields

### Profile Module

Handles:
- retailer public profile
- logo/cover assets
- categories
- contact details

### Redemptions Module

Handles:
- redemption history
- recent scans
- outcome visibility
- filtering by offer/date

### Scan Module

Handles:
- browser camera scan
- QR result processing
- server-side validation handoff
- result display

### Billing Module

Handles:
- retailer annual plan state
- renewals/cancellation view
- Stripe billing links

---

## Retailer Portal Access Rules

- retailer users can only access their own retailer context
- owner/manager/staff roles may evolve later
- all mutations must check linked retailer access server-side
- no client-side-only authorization

---

## Admin Portal Structure

### Recommended Folder Structure

```text
apps/admin/
├── app/
│   ├── (auth)/
│   │   ├── sign-in/
│   │   │   └── page.tsx
│   │   └── layout.tsx
│   │
│   ├── (dashboard)/
│   │   ├── dashboard/
│   │   │   └── page.tsx
│   │   ├── retailers/
│   │   │   ├── page.tsx
│   │   │   └── [retailerId]/
│   │   │       └── page.tsx
│   │   ├── offers/
│   │   │   ├── page.tsx
│   │   │   └── [offerId]/
│   │   │       └── page.tsx
│   │   ├── members/
│   │   │   ├── page.tsx
│   │   │   └── [memberId]/
│   │   │       └── page.tsx
│   │   ├── redemptions/
│   │   │   └── page.tsx
│   │   ├── categories/
│   │   │   └── page.tsx
│   │   ├── subscriptions/
│   │   │   └── page.tsx
│   │   ├── featured/
│   │   │   └── page.tsx
│   │   ├── audit/
│   │   │   └── page.tsx
│   │   ├── settings/
│   │   │   └── page.tsx
│   │   └── layout.tsx
│   │
│   ├── layout.tsx
│   └── page.tsx
│
├── components/
│   ├── layout/
│   │   ├── admin_sidebar.tsx
│   │   ├── admin_header.tsx
│   │   └── admin_shell.tsx
│   ├── retailers/
│   ├── offers/
│   ├── members/
│   ├── redemptions/
│   ├── subscriptions/
│   ├── audit/
│   └── shared/
│
├── features/
│   ├── auth/
│   ├── dashboard/
│   ├── retailers/
│   ├── offers/
│   ├── members/
│   ├── redemptions/
│   ├── categories/
│   ├── subscriptions/
│   ├── featured/
│   ├── audit/
│   └── settings/
│
├── lib/
│   ├── auth/
│   │   ├── require_admin.ts
│   │   └── get_admin_context.ts
│   ├── supabase/
│   │   ├── client.ts
│   │   ├── server.ts
│   │   └── middleware.ts
│   ├── actions/
│   ├── queries/
│   ├── mappers/
│   ├── validators/
│   └── utils/
│
├── middleware.ts
├── types/
├── public/
└── README.md
```

---

## Admin Portal Module Guidance

### Dashboard Module

Handles:
- active members
- active retailers
- pending approvals
- recent redemptions
- flagged patterns
- subscription health

### Retailers Module

Handles:
- search/list retailers
- retailer review
- approval/rejection
- suspension/hide actions

### Offers Module

Handles:
- offer review
- approval/rejection
- pause/hide actions
- featured toggles later if desired

### Members Module

Handles:
- member lookup
- membership state visibility
- redemption history visibility
- support context

### Redemptions Module

Handles:
- redemption monitoring
- suspicious trend review
- audit visibility

### Categories Module

Handles:
- category CRUD
- ordering
- active/inactive visibility

### Subscriptions Module

Handles:
- consumer and retailer billing inspection
- renewal/cancellation state visibility

### Featured Module

Handles:
- curated merchandising
- homepage features
- campaign slots later

### Audit Module

Handles:
- admin actions
- system events
- moderation traceability

---

## Shared lib/ Guidance

### lib/auth/

Contains server-side access guards. Examples:
- require_admin.ts
- require_retailer_user.ts

### lib/queries/

Contains read operations for server-rendered pages or server actions.

### lib/actions/

Contains mutations:
- create offer
- update location
- approve retailer
- validate redemption result submission

### lib/validators/

Contains Zod schemas and form validation logic.

### lib/mappers/

Maps raw DB rows into portal-friendly view models.

### lib/utils/

Formatting helpers:
- dates
- currency
- distances
- status badges

---

## Shared Package Guidance

### packages/ui

Use for genuinely reusable components between admin and retailer portals:
- cards
- tables
- filters
- badges
- empty states
- metric blocks
- dialogs

Do not put app-specific business logic here.

### packages/types

Use for:
- shared TypeScript types
- DTOs
- enums mirrored from backend where sensible

Do not let types drift from Supabase-generated or canonical backend types.

### packages/config

Use for:
- shared constants
- app metadata
- environment helpers for web apps

---

## Data Access Strategy

Recommended pattern:
- server-rendered reads where possible
- server actions or route handlers for mutations
- Supabase access centralized in lib layer
- strict auth checks in mutation paths

Avoid:
- random client-side writes directly to Supabase from many components
- mixing form UI and mutation logic into giant page files

---

## Design System Guidance

Use a clean dashboard UI with:
- left sidebar
- sticky header
- card-based summaries
- table/list-heavy management views
- consistent status badges
- clear approval/rejection actions

Retailer portal should feel simpler and more commercial. Admin portal should feel more operational and data-heavy.

---

## Initial Build Sequence

### Retailer Portal

1. auth guard and shell
2. dashboard
3. profile
4. locations
5. offers list
6. create/edit offer
7. scan page
8. redemption history
9. billing

### Admin Portal

1. auth guard and shell
2. dashboard
3. retailer queue
4. offer queue
5. retailer management
6. offers management
7. redemptions monitoring
8. members lookup
9. categories
10. subscriptions
11. audit

---

## Non-Negotiables

- retailer users must never see another retailer's data
- admin authorization must be enforced server-side
- redemption validation cannot rely only on portal UI
- business-critical mutations should be centralized and auditable
- do not create one mega-dashboard app for both retailer and admin
