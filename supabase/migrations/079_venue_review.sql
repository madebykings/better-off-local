-- 079_venue_review.sql
-- Adds venue-level review/moderation fields to retailer_locations.
--
-- PREREQUISITE: Migration 078 (078_venue_public_fields.sql) must be applied
-- first. This migration adds phone, website_url, short_description, description
-- to retailer_locations. If those columns are absent, queries in the portal
-- and admin apps will fail with a clear Supabase column-not-found error
-- (not silently return null data).
--
-- Venue review statuses follow the offer_status pattern (single column,
-- check constraint) rather than the dual approval_status/visibility_status
-- pattern used for retailer onboarding.
--
-- Status lifecycle:
--   draft      → venue created but not yet submitted for review
--   pending    → retailer has saved/submitted; awaiting admin review
--   approved   → admin approved; venue is live in consumer discovery
--   rejected   → admin rejected; retailer can see reason and resubmit

alter table retailer_locations
  add column if not exists review_status  text not null default 'draft'
    check (review_status in ('draft', 'pending', 'approved', 'rejected')),
  add column if not exists review_notes   text,
  add column if not exists submitted_at   timestamptz,
  add column if not exists approved_at    timestamptz,
  add column if not exists approved_by    uuid references profiles(id),
  add column if not exists rejected_at    timestamptz,
  add column if not exists rejected_by    uuid references profiles(id);

-- Back-fill: venues belonging to already-approved retailers are already live.
-- Auto-approve them so no currently-live listing is disrupted on deploy.
update retailer_locations rl
  set review_status = 'approved'
 from retailers r
where rl.retailer_id = r.id
  and r.approval_status = 'approved';

-- Rebuild consumer_discovery_retailers to filter on venue review_status = 'approved'.
-- The back-fill above ensures existing live venues are not disrupted.
-- Going forward, a venue must be explicitly approved by admin before it is
-- exposed in consumer discovery.
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
    loc.address_line_1,
    loc.town,
    loc.postcode,
    loc.latitude,
    loc.longitude,
    loc.opening_hours_json,
    coalesce(loc.is_featured, false)                 as is_featured,
    coalesce(loc.created_at, r.created_at)           as created_at,
    (
      select count(*)::integer
        from redemptions rd
       where rd.retailer_id = r.id
         and rd.status = 'success'
         and rd.redeemed_at >= now() - interval '30 days'
    ) as recent_redemption_count,
    (
      select count(*)::integer
        from favourites f
       where f.retailer_id = r.id
    ) as favourite_count,
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
  join retailer_locations loc
    on loc.retailer_id = r.id
   and loc.is_primary = true
   and loc.review_status = 'approved'
 where r.approval_status = 'approved'
   and r.visibility_status = 'live'
   and r.is_active = true;

grant select on consumer_discovery_retailers to anon, authenticated;
