-- 018_rls_policies.sql
-- Baseline row-level security policies for all application tables
-- These are conservative starting policies. Refine as app logic matures.

-- Enable RLS on all tables
alter table profiles enable row level security;
alter table consumer_memberships enable row level security;
alter table retailers enable row level security;
alter table retailer_users enable row level security;
alter table retailer_locations enable row level security;
alter table retailer_subscriptions enable row level security;
alter table categories enable row level security;
alter table retailer_categories enable row level security;
alter table offers enable row level security;
alter table offer_rules enable row level security;
alter table favourites enable row level security;
alter table redemption_tokens enable row level security;
alter table redemptions enable row level security;
alter table offer_views enable row level security;
alter table notifications enable row level security;
alter table admin_actions enable row level security;
alter table audit_events enable row level security;

-- ============================================================
-- Helper: check if current user is admin
-- ============================================================
create or replace function is_admin()
returns boolean as $$
  select exists (
    select 1 from profiles
    where id = auth.uid() and role = 'admin' and is_active = true
  );
$$ language sql security definer stable;

-- ============================================================
-- profiles
-- ============================================================
create policy "Users can read their own profile"
  on profiles for select
  using (id = auth.uid());

create policy "Admins can read all profiles"
  on profiles for select
  using (is_admin());

create policy "Users can update their own profile"
  on profiles for update
  using (id = auth.uid());

-- ============================================================
-- consumer_memberships
-- ============================================================
create policy "Consumers can read their own membership"
  on consumer_memberships for select
  using (profile_id = auth.uid());

create policy "Admins can read all memberships"
  on consumer_memberships for select
  using (is_admin());

-- Inserts/updates should happen through backend functions only

-- ============================================================
-- categories
-- ============================================================
create policy "Anyone can read active categories"
  on categories for select
  using (is_active = true);

create policy "Admins can manage categories"
  on categories for all
  using (is_admin());

-- ============================================================
-- retailers
-- ============================================================
create policy "Public can read approved live retailers"
  on retailers for select
  using (
    approval_status = 'approved'
    and visibility_status = 'live'
    and is_active = true
  );

create policy "Retailer users can read their own retailer"
  on retailers for select
  using (
    exists (
      select 1 from retailer_users ru
      where ru.retailer_id = retailers.id
        and ru.profile_id = auth.uid()
        and ru.is_active = true
    )
  );

create policy "Retailer users can update their own retailer"
  on retailers for update
  using (
    exists (
      select 1 from retailer_users ru
      where ru.retailer_id = retailers.id
        and ru.profile_id = auth.uid()
        and ru.is_active = true
        and ru.access_role in ('owner', 'manager')
    )
  );

create policy "Admins can manage all retailers"
  on retailers for all
  using (is_admin());

-- ============================================================
-- retailer_users
-- ============================================================
create policy "Retailer users can read their own retailer links"
  on retailer_users for select
  using (profile_id = auth.uid());

create policy "Admins can read all retailer users"
  on retailer_users for select
  using (is_admin());

-- ============================================================
-- retailer_locations
-- ============================================================
create policy "Public can read locations of live retailers"
  on retailer_locations for select
  using (
    is_active = true
    and exists (
      select 1 from retailers r
      where r.id = retailer_locations.retailer_id
        and r.approval_status = 'approved'
        and r.visibility_status = 'live'
    )
  );

create policy "Retailer users can manage their own locations"
  on retailer_locations for all
  using (
    exists (
      select 1 from retailer_users ru
      where ru.retailer_id = retailer_locations.retailer_id
        and ru.profile_id = auth.uid()
        and ru.is_active = true
    )
  );

create policy "Admins can manage all locations"
  on retailer_locations for all
  using (is_admin());

-- ============================================================
-- retailer_subscriptions
-- ============================================================
create policy "Retailer users can read their own subscription"
  on retailer_subscriptions for select
  using (
    exists (
      select 1 from retailer_users ru
      where ru.retailer_id = retailer_subscriptions.retailer_id
        and ru.profile_id = auth.uid()
        and ru.is_active = true
    )
  );

create policy "Admins can read all retailer subscriptions"
  on retailer_subscriptions for select
  using (is_admin());

-- ============================================================
-- offers
-- ============================================================
create policy "Public can read live offers from active retailers"
  on offers for select
  using (
    status = 'live'
    and exists (
      select 1 from retailers r
      where r.id = offers.retailer_id
        and r.approval_status = 'approved'
        and r.visibility_status = 'live'
    )
  );

create policy "Retailer users can manage their own offers"
  on offers for all
  using (
    exists (
      select 1 from retailer_users ru
      where ru.retailer_id = offers.retailer_id
        and ru.profile_id = auth.uid()
        and ru.is_active = true
    )
  );

create policy "Admins can manage all offers"
  on offers for all
  using (is_admin());

-- ============================================================
-- offer_rules
-- ============================================================
create policy "Anyone can read rules for accessible offers"
  on offer_rules for select
  using (
    exists (
      select 1 from offers o
      where o.id = offer_rules.offer_id
        and o.status = 'live'
    )
  );

create policy "Retailer users can manage offer rules"
  on offer_rules for all
  using (
    exists (
      select 1 from offers o
      join retailer_users ru on ru.retailer_id = o.retailer_id
      where o.id = offer_rules.offer_id
        and ru.profile_id = auth.uid()
        and ru.is_active = true
    )
  );

create policy "Admins can manage all offer rules"
  on offer_rules for all
  using (is_admin());

-- ============================================================
-- favourites
-- ============================================================
create policy "Users can manage their own favourites"
  on favourites for all
  using (profile_id = auth.uid());

-- ============================================================
-- redemption_tokens
-- ============================================================
-- Direct access is blocked. Token creation and validation
-- should happen through server-side edge functions only.
create policy "Admins can read redemption tokens"
  on redemption_tokens for select
  using (is_admin());

-- ============================================================
-- redemptions
-- ============================================================
create policy "Consumers can read their own redemption history"
  on redemptions for select
  using (profile_id = auth.uid());

create policy "Retailer users can read redemptions for their retailers"
  on redemptions for select
  using (
    exists (
      select 1 from retailer_users ru
      where ru.retailer_id = redemptions.retailer_id
        and ru.profile_id = auth.uid()
        and ru.is_active = true
    )
  );

create policy "Admins can read all redemptions"
  on redemptions for select
  using (is_admin());

-- ============================================================
-- offer_views
-- ============================================================
create policy "Users can insert their own offer views"
  on offer_views for insert
  with check (profile_id = auth.uid() or profile_id is null);

create policy "Retailer users can read views for their offers"
  on offer_views for select
  using (
    exists (
      select 1 from retailer_users ru
      where ru.retailer_id = offer_views.retailer_id
        and ru.profile_id = auth.uid()
        and ru.is_active = true
    )
  );

create policy "Admins can read all offer views"
  on offer_views for select
  using (is_admin());

-- ============================================================
-- notifications
-- ============================================================
create policy "Users can read their own notifications"
  on notifications for select
  using (profile_id = auth.uid());

create policy "Users can mark their own notifications read"
  on notifications for update
  using (profile_id = auth.uid());

-- ============================================================
-- admin_actions
-- ============================================================
create policy "Admins can read and insert admin actions"
  on admin_actions for all
  using (is_admin());

-- ============================================================
-- audit_events
-- ============================================================
create policy "Admins can read audit events"
  on audit_events for select
  using (is_admin());
