# Architecture Overview

## System Architecture

Better Off Local is a monorepo containing three applications backed by a shared Supabase (PostgreSQL + Auth + Storage + Edge Functions) backend.

```
┌─────────────────────────────────────────────────────────┐
│                     Client Applications                  │
│                                                          │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────┐ │
│  │  Mobile App  │  │  Admin Portal│  │Retailer Portal│ │
│  │  (Flutter)   │  │  (Next.js)   │  │  (Next.js)    │ │
│  └──────┬───────┘  └──────┬───────┘  └───────┬───────┘ │
└─────────┼─────────────────┼──────────────────┼─────────┘
          │                 │                  │
          └─────────────────┼──────────────────┘
                            │
                    ┌───────▼────────┐
                    │    Supabase    │
                    │                │
                    │  ┌──────────┐  │
                    │  │ Postgres │  │
                    │  ├──────────┤  │
                    │  │   Auth   │  │
                    │  ├──────────┤  │
                    │  │ Storage  │  │
                    │  ├──────────┤  │
                    │  │  Edge Fn │  │
                    │  └──────────┘  │
                    └────────────────┘
```

## Applications

| App | Tech | Users | Purpose |
|-----|------|-------|---------|
| `apps/mobile` | Flutter | Consumers | Discover retailers, scan QR, earn/redeem rewards |
| `apps/admin` | Next.js | Internal team | Platform management, analytics, retailer approval |
| `apps/retailer-portal` | Next.js | Retailers | Profile management, QR scanner, customer insights |

## Shared Packages

| Package | Purpose |
|---------|---------|
| `packages/config` | Shared env helpers, constants, feature flags |
| `packages/types` | Shared TypeScript types for web apps |
| `packages/ui` | Shared UI component library (admin + retailer portal) |

## Infrastructure

- **Database & Auth**: Supabase (PostgreSQL 15, GoTrue)
- **Storage**: Supabase Storage (S3-compatible)
- **Edge Functions**: Supabase Edge Functions (Deno)
- **CI/CD**: GitHub Actions
- **Monorepo tooling**: Turborepo + pnpm workspaces
