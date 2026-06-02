-- 070_offer_fields_regions_platform_config.sql
-- Adds missing fields required for pre-launch feature completeness.
--
-- Changes:
--   1. offer_type enum: add buy_one_get_one, meal_deal
--   2. offers.estimated_saving_pence — retailer-provided saving estimate
--   3. regions.description — public-facing region description
--   4. platform_config table — admin-editable homepage content
--   5. Update consumer_discovery_offers view to expose estimated_saving_pence

-- ── 1. Expand offer_type enum ─────────────────────────────────────────────────
-- ALTER TYPE ... ADD VALUE is transactional in PG14+ but cannot run inside a
-- transaction that has already seen the type. Run as separate statements.

alter type offer_type add value if not exists 'buy_one_get_one';
alter type offer_type add value if not exists 'meal_deal';

-- ── 2. offers.estimated_saving_pence ─────────────────────────────────────────

alter table offers
  add column if not exists estimated_saving_pence integer;

comment on column offers.estimated_saving_pence is
  'Retailer-provided estimate of the monetary saving in pence (e.g. 350 = £3.50).
   Used in consumer savings screen, offer cards, and analytics. Nullable.';

-- ── 3. regions.description ────────────────────────────────────────────────────

alter table regions
  add column if not exists description text;

comment on column regions.description is
  'Public-facing description of this region shown in the consumer app.';

-- ── 4. platform_config ────────────────────────────────────────────────────────
-- Single-row table for admin-editable platform configuration.
-- Constraint enforces only one row ever exists.

create table if not exists platform_config (
  id                    smallint primary key default 1,
  homepage_headline     text not null default 'Discover local offers. Support local businesses.',
  homepage_body         text not null default 'Better Off Local is a paid membership giving you access to exclusive discounts at brilliant independent businesses near you.',
  homepage_cta_text     text not null default 'Join today',
  homepage_cta_url      text not null default 'https://betterofflocal.com/join',
  updated_at            timestamptz not null default now(),
  constraint platform_config_single_row check (id = 1)
);

insert into platform_config(id) values (1)
  on conflict (id) do nothing;

comment on table platform_config is
  'Single-row platform configuration. Edit via admin portal.
   No deployment required to change homepage content or CTA destination.';

-- Admin and service role can read/update.
grant select, update on platform_config to service_role;
grant select on platform_config to authenticated, anon;

-- ── 5. Update consumer_discovery_offers view ──────────────────────────────────
-- Add estimated_saving_pence so the mobile app can display savings without
-- a separate query.
--
-- Pattern: DROP + RECREATE (column added mid-list — see migration 054).

drop view if exists consumer_discovery_offers;

create view consumer_discovery_offers as
  select
    o.id,
    o.retailer_id,
    o.title,
    o.short_summary,
    o.value_text,
    o.offer_type,
    o.is_featured,
    o.image_url,
    o.estimated_saving_pence,
    o.start_at,
    o.end_at,
    o.venue_scope,
    o.created_at
  from offers o
  join retailers r on r.id = o.retailer_id
  where o.status = 'live'
    and r.approval_status = 'approved'
    and r.visibility_status = 'live'
    and r.is_active = true
    and (o.start_at is null or o.start_at <= now())
    and (o.end_at   is null or o.end_at   > now());

grant select on consumer_discovery_offers to anon, authenticated;
