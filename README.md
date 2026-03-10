# Better Off Local

A platform empowering communities to shop local through rewards, discovery, and connection.

## What's in this repo

| Path | Description |
|------|-------------|
| `apps/mobile` | Flutter consumer app (iOS + Android) |
| `apps/admin` | Next.js internal admin portal |
| `apps/retailer-portal` | Next.js retailer dashboard + QR scanner |
| `packages/config` | Shared config, env helpers, constants |
| `packages/types` | Shared TypeScript types for web apps |
| `packages/ui` | Shared UI components (admin + retailer portal) |
| `supabase/` | Migrations, seed data, edge functions |
| `docs/` | Product, architecture, roadmap, UX docs |
| `scripts/` | Dev setup and deploy helper scripts |

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org) v20+
- [pnpm](https://pnpm.io) v9+
- [Supabase CLI](https://supabase.com/docs/guides/cli)
- [Flutter](https://flutter.dev) (for mobile development)

### Setup

```bash
# Install dependencies (web apps + packages)
pnpm install

# Start local Supabase
supabase start

# Start all web apps in dev mode
pnpm dev
```

### Running individual apps

```bash
# Admin portal only
pnpm --filter admin dev

# Retailer portal only
pnpm --filter retailer-portal dev

# Mobile app
cd apps/mobile && flutter run
```

## Documentation

- [Product Vision](docs/product/vision.md)
- [Architecture Overview](docs/architecture/overview.md)
- [Data Model](docs/architecture/data-model.md)
- [Architecture Decisions](docs/architecture/decisions.md)
- [Build Roadmap](docs/roadmap/build-roadmap.md)
- [Screen List](docs/ux/screen-list.md)
