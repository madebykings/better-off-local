-- 052_retailer_venue_entitlements.sql
-- Venue allowance tracking on retailer_subscriptions.
--
-- Base plan includes 1 venue. Extra venues are purchased as a Stripe
-- subscription add-on item at £10/venue/year.
--
-- Computed allowance = venue_allowance_override ?? (1 + extra_venues_quantity)
-- Admin override takes precedence over the computed value.

alter table retailer_subscriptions
  add column extra_venue_stripe_item_id text,
  add column extra_venues_quantity      integer not null default 0,
  add column venue_allowance_override   integer;

comment on column retailer_subscriptions.extra_venue_stripe_item_id is
  'Stripe subscription item ID for the extra-venue add-on. Null when quantity = 0.';
comment on column retailer_subscriptions.extra_venues_quantity is
  'Number of extra venue slots purchased. Base allowance is always 1.';
comment on column retailer_subscriptions.venue_allowance_override is
  'Admin-only manual override. When set, replaces the computed allowance entirely.';

-- Helper: effective venue allowance for a retailer.
-- Returns 1 (default base) when no active subscription exists.
create or replace function retailer_venue_allowance(p_retailer_id uuid)
returns integer
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select coalesce(
    -- Admin override takes precedence
    (select venue_allowance_override
       from retailer_subscriptions
      where retailer_id = p_retailer_id
        and status = 'active'
        and venue_allowance_override is not null
      limit 1),
    -- Computed: 1 base + purchased extras
    1 + coalesce(
      (select extra_venues_quantity
         from retailer_subscriptions
        where retailer_id = p_retailer_id
          and status = 'active'
        limit 1),
      0
    )
  );
$$;

grant execute on function retailer_venue_allowance(uuid) to authenticated, service_role;
