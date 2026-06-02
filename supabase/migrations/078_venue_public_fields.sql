-- 078_venue_public_fields.sql
-- Adds owner contact fields to retailers and venue-level public fields
-- to retailer_locations, aligning the data model so that:
--   retailers  → brand identity + owner contact
--   retailer_locations → public-facing listing content per venue

-- ── 1. Owner contact name on retailers ───────────────────────────────────────

alter table retailers
  add column if not exists contact_name text;

-- ── 2. Public-facing listing fields on retailer_locations ────────────────────

alter table retailer_locations
  add column if not exists phone text,
  add column if not exists website_url text,
  add column if not exists short_description text,
  add column if not exists description text;
