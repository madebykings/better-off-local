# Better Off Local – Claude Code Guide

## Project Overview
Better Off Local is a consumer loyalty platform for local independent retailers.
- **Consumer app**: Flutter (iOS + Android)
- **Retailer portal**: Next.js web app for local businesses
- **Admin portal**: Next.js web app for internal operations
- **Backend**: Supabase (Postgres, Auth, Storage, Edge Functions)

## Repo Structure
```
apps/
  mobile/           Flutter consumer app
  retailer-portal/  Next.js retailer dashboard
  admin/            Next.js admin dashboard
packages/
  ui/               Shared React components (retailer + admin only)
  types/            Shared TypeScript types and DTOs
  config/           Shared constants and env helpers
docs/
  architecture/     Architecture decision records and structure guides
supabase/           Migrations, seed, edge functions
```

## Architecture Docs
Always read these before making structural changes:
- `docs/architecture/flutter-app-structure.md`
- `docs/architecture/nextjs-portals-structure.md`

## Key Rules

### Flutter (apps/mobile)
- State management: Riverpod (flutter_riverpod)
- Navigation: go_router
- Feature-first folder structure under `lib/features/`
- All Supabase access goes through `core/services/` and feature `data/` layers
- Never call Supabase directly from widgets or screens
- Never hardcode membership status in UI
- Never validate redemptions client-side only

### Next.js Portals (apps/retailer-portal, apps/admin)
- Framework: Next.js App Router with TypeScript
- Styling: Tailwind CSS + shadcn/ui
- All auth guards live in `lib/auth/` and run server-side
- All Supabase access centralized in `lib/supabase/` and `lib/queries/`
- Mutations go through `lib/actions/` (server actions)
- Retailer users must never see another retailer's data — enforced server-side
- Admin auth must be enforced server-side, not just in middleware

### Shared Packages
- `packages/ui` — only genuinely shared components, no app business logic
- `packages/types` — shared TS types, keep in sync with Supabase schema
- `packages/config` — shared constants and env helpers

## Development Commands
```bash
# Web portals (from repo root)
npm run dev:retailer     # retailer portal
npm run dev:admin        # admin portal
npm run build            # build all web apps
npm run lint             # lint all web apps

# Flutter (from apps/mobile)
flutter run              # run on connected device/emulator
flutter test             # run unit + widget tests
flutter test integration_test/  # run integration tests
```

## Environment Setup
Each Next.js app has a `.env.local.example` — copy to `.env.local` and fill in:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (server-side only, never expose to client)

Flutter env is managed via `lib/core/config/env.dart` — see that file for setup.

## Non-Negotiables
- Do not put retailer or admin logic in the Flutter app
- Do not create a single merged dashboard for both portals
- Do not bypass server-side auth guards
- Do not duplicate shared UI between portals — use packages/ui
- Do not add full feature implementations without architecture review
