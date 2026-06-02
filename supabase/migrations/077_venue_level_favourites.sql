-- 077_venue_level_favourites.sql
-- Adds venue-level tracking to the favourites table and rebuilds
-- consumer_discovery_retailers to compute badge counts at venue level.
--
-- Problem with migration 076:
--   favourite_count and recent_redemption_count were counted at retailer
--   level only. Retailers with multiple venues inflate counts for every card.
--   Badge logic should prefer venue-specific activity.
--
-- Changes:
--   1. favourites.retailer_location_id — new nullable FK to retailer_locations.
--      Lets a save be associated with the specific venue the consumer saw.
--      The existing unique constraint (profile_id, retailer_id, offer_id)
--      is preserved: one save per retailer, location is tagging metadata.
--
--   2. Backfill: existing retailer saves get their primary location attached
--      so counts are immediately venue-attributed.
--
--   3. consumer_discovery_retailers view rebuilt to:
--      a) Expose loc.id as primary_location_id so the mobile app can pass
--         it when writing a favourite (venue-level attribution at write time).
--      b) Count favourites WHERE retailer_location_id = loc.id (venue-specific)
--         OR retailer_location_id IS NULL (pre-migration / unattributed).
--         When loc.id is NULL (no primary location) the second branch is the
--         only one that fires — correct fallback behaviour.
--      c) Count redemptions on the same venue-first / untagged-fallback logic.
--         retailer_location_id is nullable in redemptions too; venue tagging
--         depends on the scanner implementation. Untagged rows are included
--         as backfill-equivalent behaviour.

-- ── 1. Add retailer_location_id to favourites ─────────────────────────────────

alter table favourites
  add column if not exists retailer_location_id
    uuid references retailer_locations(id) on delete set null;

-- ── 2. Backfill existing retailer saves to their primary location ─────────────

update favourites f
   set retailer_location_id = (
         select rl.id
           from retailer_locations rl
          where rl.retailer_id  = f.retailer_id
            and rl.is_primary   = true
            and rl.is_active    = true
          limit 1
       )
 where f.retailer_id          is not null
   and f.retailer_location_id is null;

-- ── 3. Rebuild consumer_discovery_retailers ───────────────────────────────────
-- Notes on the venue-level count logic:
--
--   Condition: (col = loc.id OR col IS NULL)
--
--   When loc.id is a real UUID:
--     col = loc.id   → venue-specific rows  (exact match)
--     col IS NULL    → untagged rows         (pre-migration fallback)
--     Combined: venue-specific + untagged.   Slight overcount for multi-venue
--     retailers when untagged rows existed before venue tagging was enforced.
--     Acceptable at MVP scale; will self-correct as new saves/redemptions
--     carry explicit location IDs.
--
--   When loc.id is NULL (left join produced no primary location row):
--     col = NULL     → SQL NULL = NULL → always false — no rows matched.
--     col IS NULL    → all untagged rows for this retailer.
--     Combined: effectively retailer-level fallback for location-less retailers.

drop view if exists consumer_discovery_retailers;

create view consumer_discovery_retailers as
  select
    r.id,
    r.name,
    r.slug,
    r.tagline,
    r.description,
    r.short_description,
    coalesce(loc.logo_url,        r.logo_url)        as logo_url,
    coalesce(loc.cover_image_url, r.cover_image_url) as cover_image_url,
    r.website_url,
    r.phone,
    r.email,
    loc.id                                           as primary_location_id,
    loc.address_line_1,
    loc.town,
    loc.postcode,
    loc.latitude,
    loc.longitude,
    loc.opening_hours_json,
    -- Badge: venue-level featured (admin-toggled per location)
    coalesce(loc.is_featured, false)                 as is_featured,
    -- Badge: venue created_at for ✨ New (falls back to retailer)
    coalesce(loc.created_at, r.created_at)           as created_at,
    -- Badge: recent redemptions — venue-specific + untagged fallback (30 days)
    (
      select count(*)::integer
        from redemptions rd
       where rd.retailer_id = r.id
         and (rd.retailer_location_id = loc.id or rd.retailer_location_id is null)
         and rd.status = 'success'
         and rd.redeemed_at >= now() - interval '30 days'
    ) as recent_redemption_count,
    -- Badge: saves — venue-specific + untagged fallback
    (
      select count(*)::integer
        from favourites f
       where f.retailer_id = r.id
         and (f.retailer_location_id = loc.id or f.retailer_location_id is null)
    ) as favourite_count,
    -- Utility
    (
      select count(*)::integer
        from retailer_locations l
       where l.retailer_id = r.id and l.is_active = true
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
         where rc.retailer_id = r.id and c.is_active = true
      ),
      '[]'::json
    ) as category_names
  from retailers r
  left join retailer_locations loc
    on loc.retailer_id = r.id and loc.is_primary = true
  where r.approval_status = 'approved'
    and r.visibility_status = 'live'
    and r.is_active = true;

grant select on consumer_discovery_retailers to anon, authenticated;
