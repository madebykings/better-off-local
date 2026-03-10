# Supabase

This directory contains all Supabase-related resources for Better Off Local.

## Structure

- `migrations/` — SQL migration files, applied in order by Supabase CLI
- `seed/` — Seed data scripts for local development and staging
- `functions/` — Supabase Edge Functions (Deno-based serverless functions)

## Getting Started

```bash
# Install Supabase CLI
npm install -g supabase

# Start local Supabase stack
supabase start

# Apply migrations
supabase db push

# Run seed data
supabase db seed

# Deploy edge functions
supabase functions deploy
```

## Local Development

The local Supabase stack runs at:
- Studio: http://localhost:54323
- API: http://localhost:54321
- DB: postgresql://postgres:postgres@localhost:54322/postgres
