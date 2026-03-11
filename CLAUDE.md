# Better Off Local

## Product Summary
Better Off Local is a paid local discount and loyalty membership platform launching first in Clackmannanshire, Scotland.

Consumers pay monthly or annually to access verified local discounts.
Retailers pay annually to appear on the platform, manage offers, and validate redemptions.

This is a production product, not an MVP.

## Platforms
- Flutter mobile app for consumers
- Next.js retailer portal
- Next.js admin portal
- Supabase backend
- Stripe billing
- Google Maps location discovery

## Core User Types
1. Consumer members
2. Retailers
3. Internal admins

## Product Principles
- Hyper-local launch first
- Value must be obvious immediately
- Offers must be easy to discover and redeem
- Redemption must be fraud-resistant
- Retailer setup must be simple
- Architecture must scale beyond one launch region

## Non-Negotiable Business Rules
- Consumers must have an active paid membership to redeem offers
- Retailers must have an active paid plan to be publicly visible
- Redemption validation must happen server-side
- QR codes must be short-lived and tied to authenticated membership state
- Offers can have rules such as one per user, one per day, validity windows, start/end dates, and redemption caps
- Launch geography is Clackmannanshire first
- Better Off Local is a paid membership product, not a free listing site

## Coding Rules
- Prefer clear modular architecture
- Do not invent hidden business logic
- Keep files readable and production-ready
- Preserve existing patterns unless clearly broken
- Add documentation when behaviour, schema, routes, or env requirements change
- For major features, provide brief implementation plans before coding

## Delivery Workflow
When asked to implement a feature:
1. Read this file and relevant docs first
2. Inspect the relevant existing files
3. Summarize the implementation plan
4. Implement only the requested slice
5. Summarize changed files
6. Note assumptions, risks, and follow-up tasks
