-- 030_onboarding_columns.sql
-- Onboarding persistence: step tracking, tagline field, and platform-agnostic links table.

-- ── Onboarding step enum ─────────────────────────────────────────────────────

create type onboarding_step_enum as enum (
  'business-details',
  'branding',
  'categories',
  'location',
  'opening-hours',
  'links',
  'first-offer',
  'preview',
  'submitted'
);

-- ── Retailers: add onboarding columns ────────────────────────────────────────

alter table retailers
  add column onboarding_step onboarding_step_enum not null default 'business-details',
  add column tagline          text,
  add column business_type    text;  -- Display category shown on the listing card (e.g. "Food & Drink")

-- ── Retailer links (replaces per-platform social URL columns) ────────────────
-- Stores any number of typed links (website, instagram, facebook, tiktok, etc.)
-- per retailer. The `type` column is a free-text label — no DB-level constraint
-- so new platforms can be added without schema changes.

create table retailer_links (
  id          uuid        primary key default gen_random_uuid(),
  retailer_id uuid        not null references retailers(id) on delete cascade,
  type        text        not null,
  url         text        not null,
  created_at  timestamptz not null default now()
);

create index retailer_links_retailer_id_idx on retailer_links(retailer_id);

alter table retailer_links enable row level security;

-- Retailer owners/managers can manage their own links via the service-role
-- server actions; no direct client access is needed.
-- Public read access is granted so the consumer app can display links.
create policy "public can read retailer links"
  on retailer_links for select
  using (true);
