# Better Off Local – Admin Portal

Next.js App Router internal admin dashboard.

## Setup

```bash
# From apps/admin
cp .env.local.example .env.local
# Fill in NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY

npm install
npm run dev   # runs on http://localhost:3002
```

## Architecture

See `docs/architecture/nextjs-portals-structure.md` for full documentation.

### Key patterns
- Auth guard: `lib/auth/require_admin.ts` — enforced server-side
- Supabase: `lib/supabase/server.ts` for server, `lib/supabase/client.ts` for browser

### Routes
| Route | Description |
|-------|-------------|
| `/sign-in` | Admin sign in |
| `/dashboard` | Platform overview |
| `/retailers` | Retailer list + review queue |
| `/retailers/[id]` | Retailer detail + moderation |
| `/offers` | Offer review queue |
| `/offers/[id]` | Offer detail + moderation |
| `/members` | Member lookup |
| `/members/[id]` | Member detail |
| `/redemptions` | Redemption monitoring |
| `/categories` | Category management |
| `/subscriptions` | Billing inspection |
| `/featured` | Featured content slots |
| `/audit` | Audit log |
| `/settings` | Admin settings |
