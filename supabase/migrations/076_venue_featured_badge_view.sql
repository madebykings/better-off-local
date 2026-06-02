-- 076_venue_featured_badge_view.sql
-- Moves the Featured badge to venue/location level and rebuilds
-- consumer_discovery_retailers with correct badge-driving fields.
--
-- Context:
--   Migration 075 added retailers.is_featured (retailer-level). This is wrong
--   because admins need to feature individual venues, not all venues owned by
--   the same retailer. This migration adds is_featured at the
--   retailer_locations level and rebuilds the view to use it.
--   retailers.is_featured is left harmless in the table but the view no longer
--   exposes it.
--
-- Badge fields exposed by the rebuilt view:
--   is_featured          → ⭐ Featured  (venue-level boolean)
--   created_at           → ✨ New       (venue created_at, fallback to retailer)
--   recent_redemption_count → 🔥 Trending (retailer-level*, last 30 days)
--   favourite_count      → ❤️ Member Favourite (retailer-level*)
--
-- *Limitations (documented):
--   recent_redemption_count: counted by retailer_id because many redemption
--   rows have retailer_location_id = NULL (not all scanners tag the venue).
--   Equivalent to venue-level for single-venue retailers (hyper-local MVP).
--
--   favourite_count: the favourites table stores retailer_id only, no
--   location_id. Venue-level favourite counts are impossible without a schema
--   change to favourites. Documented as retailer-level approximation.

-- ── 1. Add is_featured to retailer_locations ─────────────────────────────────

alter table retailer_locations
  add column if not exists is_featured boolean not null default false;

-- ── 2. Rebuild consumer_discovery_retailers ───────────────────────────────────

drop view if exists consumer_discovery_retailers;

create view consumer_discovery_retailers as
  select
    r.id,
    r.name,
    r.slug,
    r.tagline,
    r.description,
    r.short_description,
    -- Prefer venue-level images; fall back to retailer-level.
    coalesce(loc.logo_url,        r.logo_url)        as logo_url,
    coalesce(loc.cover_image_url, r.cover_image_url) as cover_image_url,
    r.website_url,
    r.phone,
    r.email,
    loc.address_line_1,
    loc.town,
    loc.postcode,
    loc.latitude,
    loc.longitude,
    loc.opening_hours_json,
    -- Badge: venue-level featured flag (admin-toggled per location)
    coalesce(loc.is_featured, false)                 as is_featured,
    -- Badge: venue created_at for ✨ New (falls back to retailer created_at)
    coalesce(loc.created_at, r.created_at)           as created_at,
    -- Badge: recent redemption activity at retailer level (30-day window)
    -- Counted at retailer level because redemptions.retailer_location_id is
    -- nullable (not all redemption rows carry a venue ID).
    (
      select count(*)::integer
        from redemptions rd
       where rd.retailer_id = r.id
         and rd.status = 'success'
         and rd.redeemed_at >= now() - interval '30 days'
    ) as recent_redemption_count,
    -- Badge: save/favourite count at retailer level
    -- The favourites table has no location_id; this is the closest proxy.
    (
      select count(*)::integer
        from favourites f
       where f.retailer_id = r.id
    ) as favourite_count,
    -- Utility counts
    (
      select count(*)::integer
        from retailer_locations l
       where l.retailer_id = r.id
         and l.is_active = true
    ) as location_count,
    (
      select count(*)::integer
        from offers o
       where o.retailer_id = r.id
         and o.status = 'live'
         and (o.start_at is null or o.start_at <= now())
         and (o.end_at   is null or o.end_at   > now())
    ) as active_offer_count,
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

grant select on consumer_discovery_retailers to anon, authenticated;
