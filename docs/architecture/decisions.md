# Architecture Decision Records

## ADR-001: Flutter for Mobile App

**Status**: Accepted

**Context**: Need a mobile app for iOS and Android consumers.

**Decision**: Use Flutter for cross-platform development.

**Reasons**:
- Single codebase for iOS + Android
- Strong performance with native compilation
- Rich widget ecosystem
- Good Supabase SDK support (`supabase_flutter`)

---

## ADR-002: Next.js for Web Portals

**Status**: Accepted

**Context**: Need admin and retailer-facing web applications.

**Decision**: Use Next.js (App Router) for both `admin` and `retailer-portal`.

**Reasons**:
- SSR/SSG flexibility
- Strong TypeScript support
- Shared component library via `packages/ui`
- Familiar to most web developers

---

## ADR-003: Supabase as Backend

**Status**: Accepted

**Context**: Need auth, database, storage, and serverless functions.

**Decision**: Use Supabase as the primary backend platform.

**Reasons**:
- Integrated auth (email, social, magic link)
- PostgreSQL with row-level security
- Built-in storage
- Edge functions for custom logic
- Good local development experience
- Reduces need for a separate backend service

---

## ADR-004: Turborepo for Monorepo Management

**Status**: Accepted

**Context**: Multiple apps and shared packages need coordinated builds and caching.

**Decision**: Use Turborepo with pnpm workspaces.

**Reasons**:
- Remote caching for faster CI
- Task pipelines with dependency awareness
- Works well with Next.js
- pnpm workspaces for efficient package management

---

## ADR-005: Flutter Excluded from pnpm Workspace

**Status**: Accepted

**Context**: Flutter uses its own package manager (pub/dart), not npm.

**Decision**: `apps/mobile` is excluded from the pnpm workspace and Turborepo pipeline. It has its own `pubspec.yaml` and is managed independently.
