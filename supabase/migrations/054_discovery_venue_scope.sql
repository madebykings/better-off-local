-- 054_discovery_venue_scope.sql
-- Updates consumer-facing discovery views for multi-venue support.
--
-- consumer_discovery_offers: adds venue_scope so the Flutter app can
-- display "Available at all locations" vs specific venue names.
--
-- consumer_discovery_retailers: adds location_count so retailer cards
-- can show "3 locations" when a retailer has multiple active venues.

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
    (
      select count(*)::integer
        from retailer_locations l
       where l.retailer_id = r.id
         and l.is_active = true
    ) as location_count,
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

grant select on consumer_discovery_offers    to anon, authenticated;
grant select on consumer_discovery_retailers to anon, authenticated;
