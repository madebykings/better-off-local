# CLAUDE.md — Better Off Local

This file provides persistent context for AI coding assistants working on this project.

## Project Summary

Better Off Local is a platform that rewards consumers for shopping at local independent retailers. It consists of:
- A Flutter mobile app (consumer-facing)
- A Next.js retailer portal (retailer-facing, includes QR scanner)
- A Next.js admin portal (internal team)
- A Supabase backend (PostgreSQL, Auth, Storage, Edge Functions)

## Monorepo Structure

```
apps/
  mobile/           Flutter app (iOS + Android) — uses pub/dart, NOT pnpm
  admin/            Next.js app (App Router, TypeScript)
  retailer-portal/  Next.js app (App Router, TypeScript)
packages/
  config/           Shared env helpers, constants, feature flags
  types/            Shared TypeScript types
  ui/               Shared React component library
supabase/
  migrations/       SQL migrations (run via Supabase CLI)
  seed/             Seed data
  functions/        Deno-based edge functions
```

## Key Technical Decisions

- **Monorepo**: Turborepo + pnpm workspaces (Flutter app excluded from workspace)
- **Backend**: Supabase only — no separate API server
- **Auth**: Supabase Auth (GoTrue) — row-level security enforced at DB level
- **Mobile**: Flutter (`supabase_flutter` package for backend integration)
- **Web**: Next.js App Router with TypeScript

## Database Conventions

- All tables use `uuid` primary keys with `gen_random_uuid()` default
- All tables have `created_at timestamptz default now()`
- Row-level security (RLS) is enabled on all tables
- Use `profiles` table to extend `auth.users` — never modify `auth.users` directly
- Migrations are numbered sequentially: `001_init.sql`, `002_retailers.sql`, etc.

## Code Conventions

- TypeScript strict mode enabled across all web apps
- Shared types live in `packages/types` — import from there, not locally
- Environment variables accessed via helpers in `packages/config`
- UI components shared between admin and retailer portal live in `packages/ui`

## Running the Project

```bash
pnpm install          # Install all web dependencies
supabase start        # Start local Supabase
pnpm dev              # Start all web apps
cd apps/mobile && flutter run   # Start Flutter app
```

## Useful Docs

- [Architecture Overview](docs/architecture/overview.md)
- [Data Model](docs/architecture/data-model.md)
- [Architecture Decisions](docs/architecture/decisions.md)
- [Build Roadmap](docs/roadmap/build-roadmap.md)
