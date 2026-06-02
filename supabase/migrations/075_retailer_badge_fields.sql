-- 075_retailer_badge_fields.sql
-- Adds badge-driving fields to the retailers table and rebuilds the
-- consumer_discovery_retailers view to expose them to the mobile app.
--
-- Badge fields required by the BusinessCard component:
--   is_featured           → ⭐ Featured  (manual admin flag)
--   created_at            → ✨ New       (retailer joined within last 30 days)
--   total_redemption_count → 🔥 Trending  (lifetime redemptions across all offers)
--   favourite_count       → ❤️ Member Favourite (times saved by consumers)

-- ── 1. Add is_featured to retailers ──────────────────────────────────────────

alter table retailers
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
    -- Badge fields
    r.is_featured,
    r.created_at,
    (
      select count(*)::integer
        from redemptions rd
        join offers o on o.id = rd.offer_id
       where o.retailer_id = r.id
         and rd.status = 'success'
    ) as total_redemption_count,
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
