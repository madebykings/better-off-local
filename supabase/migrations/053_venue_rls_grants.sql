-- 053_venue_rls_grants.sql
-- RLS and grants for the offer_locations junction table.

alter table offer_locations enable row level security;

-- Retailer staff can read offer_locations for their own offers.
create policy "Retailer staff read own offer_locations"
  on offer_locations for select
  using (
    exists (
      select 1
        from offers o
        join retailer_users ru on ru.retailer_id = o.retailer_id
       where o.id = offer_locations.offer_id
         and ru.profile_id = auth.uid()
         and ru.is_active = true
    )
  );

-- Consumers and anon can read offer_locations for live, approved offers.
create policy "Public read live offer_locations"
  on offer_locations for select
  using (
    exists (
      select 1
        from offers o
        join retailers r on r.id = o.retailer_id
       where o.id = offer_locations.offer_id
         and o.status = 'live'
         and r.approval_status = 'approved'
         and r.visibility_status = 'live'
         and r.is_active = true
    )
  );

grant select on offer_locations to authenticated, anon;
grant all    on offer_locations to service_role;
