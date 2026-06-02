-- 072_pre_launch_hardening.sql
-- Pre-launch hardening batch:
--   1. consumer_discovery_retailers: add opening_hours_json from primary location.
--   2. consumer_discovery_offers: add retailer_name, retailer_logo_url, and
--      offer_rules fields so explore list can sort by redemption_count and still
--      display the redemption limit row correctly.
--   3. offers status enum: add 'archived' for retailer archive action.

-- ── 1. consumer_discovery_retailers — add opening_hours_json ─────────────────

drop view if exists consumer_discovery_retailers;

create view consumer_discovery_retailers as
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
    loc.opening_hours_json,
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

-- ── 2. consumer_discovery_offers — add retailer info + rules ─────────────────
-- Extends the view so the mobile explore list can:
--   a) sort by is_featured → redemption_count → created_at
--   b) display the redemption limit row (needs rules fields)

drop view if exists consumer_discovery_offers;

create view consumer_discovery_offers as
  select
    o.id,
    o.retailer_id,
    r.name                          as retailer_name,
    r.logo_url                      as retailer_logo_url,
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
    o.created_at,
    -- Offer rules (null when no rules row exists = unlimited)
    rules.max_redemptions_per_user,
    rules.max_redemptions_per_day,
    rules.max_redemptions_total,
    rules.cooldown_hours,
    coalesce(rules.new_customers_only, false) as new_customers_only,
    (
      select count(*)::integer
        from redemptions rd
       where rd.offer_id = o.id
         and rd.status = 'success'
    ) as redemption_count
  from offers o
  join retailers r on r.id = o.retailer_id
  left join offer_rules rules on rules.offer_id = o.id
  where o.status = 'live'
    and r.approval_status = 'approved'
    and r.visibility_status = 'live'
    and r.is_active = true
    and (o.start_at is null or o.start_at <= now())
    and (o.end_at   is null or o.end_at   > now());

grant select on consumer_discovery_offers to anon, authenticated;

-- ── 3. Offers status enum: add 'archived' ─────────────────────────────────────
-- Retailers can archive live/paused offers. Archived offers are hidden from
-- consumers (the view filters on status = 'live') but kept for audit history.

do $$
begin
  if not exists (
    select 1 from pg_enum
     where enumtypid = 'offer_status'::regtype
       and enumlabel  = 'archived'
  ) then
    alter type offer_status add value 'archived';
  end if;
end $$;
