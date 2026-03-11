-- 019_views_and_helpers.sql
-- Helper views and SQL functions for common business state checks

-- ============================================================
-- Helper functions
-- ============================================================

-- Check if a consumer has an active membership
create or replace function consumer_membership_is_active(p_profile_id uuid)
returns boolean as $$
  select exists (
    select 1 from consumer_memberships
    where profile_id = p_profile_id
      and status = 'active'
      and current_period_end > now()
  );
$$ language sql security definer stable;

-- Check if a retailer has an active subscription
create or replace function retailer_subscription_is_active(p_retailer_id uuid)
returns boolean as $$
  select exists (
    select 1 from retailer_subscriptions
    where retailer_id = p_retailer_id
      and status = 'active'
      and current_period_end > now()
  );
$$ language sql security definer stable;

-- Check if a profile is an admin
create or replace function is_profile_admin(p_profile_id uuid)
returns boolean as $$
  select exists (
    select 1 from profiles
    where id = p_profile_id and role = 'admin' and is_active = true
  );
$$ language sql security definer stable;

-- Check if a profile is linked to a retailer
create or replace function is_profile_linked_to_retailer(
  p_profile_id uuid,
  p_retailer_id uuid
)
returns boolean as $$
  select exists (
    select 1 from retailer_users
    where profile_id = p_profile_id
      and retailer_id = p_retailer_id
      and is_active = true
  );
$$ language sql security definer stable;

-- ============================================================
-- Views
-- ============================================================

-- Public live retailers (approved, visible, active)
create or replace view public_live_retailers as
  select r.*
  from retailers r
  where r.approval_status = 'approved'
    and r.visibility_status = 'live'
    and r.is_active = true;

-- Public live offers (live status, from active retailers)
create or replace view public_live_offers as
  select o.*
  from offers o
  join retailers r on r.id = o.retailer_id
  where o.status = 'live'
    and r.approval_status = 'approved'
    and r.visibility_status = 'live'
    and r.is_active = true
    and (o.start_at is null or o.start_at <= now())
    and (o.end_at is null or o.end_at > now());

-- Active consumer memberships
create or replace view active_consumer_memberships as
  select *
  from consumer_memberships
  where status = 'active'
    and current_period_end > now();

-- Active retailer subscriptions
create or replace view active_retailer_subscriptions as
  select *
  from retailer_subscriptions
  where status = 'active'
    and current_period_end > now();
