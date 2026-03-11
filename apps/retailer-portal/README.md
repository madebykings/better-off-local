# Better Off Local – Retailer Portal

Next.js App Router web app for local retailers to manage their Better Off Local presence.

## Setup

```bash
# From apps/retailer-portal
cp .env.local.example .env.local
# Fill in NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY

npm install
npm run dev   # runs on http://localhost:3001
```

## Architecture

See `docs/architecture/nextjs-portals-structure.md` for full documentation.

### Key patterns
- Auth guard: `lib/auth/require_retailer_user.ts` — call at top of server components
- Supabase server client: `lib/supabase/server.ts`
- Supabase browser client: `lib/supabase/client.ts`
- Mutations: `lib/actions/` (server actions)
- DB reads: `lib/queries/`
- Type mapping: `lib/mappers/`
- Validation: `lib/validators/` (Zod)

### Routes
| Route | Description |
|-------|-------------|
| `/sign-in` | Retailer sign in |
| `/forgot-password` | Password reset |
| `/dashboard` | Account overview |
| `/profile` | Public profile editor |
| `/locations` | Location management |
| `/offers` | Offer list |
| `/offers/new` | Create offer |
| `/offers/[offerId]` | Edit offer |
| `/scan` | QR scanner |
| `/redemptions` | Redemption history |
| `/billing` | Billing / Stripe |
| `/settings` | Account settings |
