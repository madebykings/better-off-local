-- 037_discovery_views.sql
-- Adds retailer tagline column and creates dedicated flat views for
-- the Flutter consumer app discovery flow.
--
-- Why dedicated views instead of embedding through public_live_retailers:
-- PostgREST embedded-resource resolution from views is fragile and
-- version-dependent. These views flatten location and categories into
-- a single row per retailer, removing the need for client-side joins.

-- ── retailers.tagline ─────────────────────────────────────────────────────────

alter table retailers add column if not exists tagline text;

-- ── consumer_discovery_retailers ──────────────────────────────────────────────
-- One row per live, approved retailer.
-- Location is the primary retailer_location (left-joined, nullable).
-- category_names is a JSON array of active category name strings, e.g.
-- ["Coffee", "Bakery"]. Returns [] (not null) when no categories assigned.

create or replace view consumer_discovery_retailers as
  select
    r.id,
    r.name,
    r.slug,
    r.tagline,
    r.description,
    r.short_description,
    r.logo_url,
    r.cover_image_url,
    r.website_url,
    r.phone,
    r.email,
    loc.address_line_1,
    loc.town,
    loc.postcode,
    loc.latitude,
    loc.longitude,
    coalesce(
      (
        select json_agg(c.name order by c.sort_order, c.name)
        from retailer_categories rc
        join categories c on c.id = rc.category_id
        where rc.retailer_id = r.id
          and c.is_active = true
      ),
      '[]'::json
    ) as category_names
  from retailers r
  left join retailer_locations loc
    on loc.retailer_id = r.id
    and loc.is_primary = true
  where r.approval_status = 'approved'
    and r.visibility_status = 'live'
    and r.is_active = true;

-- ── consumer_discovery_offers ─────────────────────────────────────────────────
-- Live offers from approved, live retailers, within their validity window.
-- Exposes only the columns needed by the Flutter consumer app.

create or replace view consumer_discovery_offers as
  select
    o.id,
    o.retailer_id,
    o.title,
    o.short_summary,
    o.value_text,
    o.offer_type,
    o.is_featured,
    o.image_url,
    o.start_at,
    o.end_at,
    o.created_at
  from offers o
  join retailers r on r.id = o.retailer_id
  where o.status = 'live'
    and r.approval_status = 'approved'
    and r.visibility_status = 'live'
    and r.is_active = true
    and (o.start_at is null or o.start_at <= now())
    and (o.end_at is null or o.end_at > now());

-- Grant read access to consumer-facing roles.
grant select on consumer_discovery_retailers to anon, authenticated;
grant select on consumer_discovery_offers to anon, authenticated;
