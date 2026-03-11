-- 022_membership_indexes.sql
-- Supports webhook upserts and fixes membership active check to include trialing.

-- Unique index on stripe_subscription_id (partial: only when set).
-- Required so webhook upserts can target a specific subscription row.
create unique index consumer_memberships_stripe_sub_id_idx
  on consumer_memberships (stripe_subscription_id)
  where stripe_subscription_id is not null;

-- Fix consumer_membership_is_active to accept 'trialing' as well as 'active'.
-- Both statuses allow redemption per product rules.
create or replace function consumer_membership_is_active(p_profile_id uuid)
returns boolean as $$
  select exists (
    select 1 from consumer_memberships
    where profile_id = p_profile_id
      and status in ('active', 'trialing')
      and current_period_end > now()
  );
$$ language sql security definer stable;

-- Align active_consumer_memberships view with the same rule.
create or replace view active_consumer_memberships as
  select *
  from consumer_memberships
  where status in ('active', 'trialing')
    and current_period_end > now();
