-- 071_offer_discovery_order.sql
-- Adds redemption_count to consumer_discovery_offers so the mobile app can
-- order offers: featured → most redeemed → newest.
--
-- DROP + RECREATE required (column added mid-list).

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
    o.created_at,
    (
      select count(*)::integer
        from redemptions rd
       where rd.offer_id = o.id
         and rd.status = 'success'
    ) as redemption_count
  from offers o
  join retailers r on r.id = o.retailer_id
  where o.status = 'live'
    and r.approval_status = 'approved'
    and r.visibility_status = 'live'
    and r.is_active = true
    and (o.start_at is null or o.start_at <= now())
    and (o.end_at   is null or o.end_at   > now());

grant select on consumer_discovery_offers to anon, authenticated;
