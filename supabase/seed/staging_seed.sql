-- supabase/seed/staging_seed.sql
-- Staging seed for Better Off Local.
--
-- Prerequisites:
--   1. Staging Supabase project created and migrations applied:
--        supabase db push --linked
--   2. Four auth users created via the Supabase dashboard
--      (Authentication → Users → Invite / Add user):
--
--        admin@betterofflocal.test
--        retailer@betterofflocal.test
--        retailer2@betterofflocal.test
--        consumer@betterofflocal.test
--
--      Note: the handle_new_user trigger creates a profiles row automatically
--      on user creation. Run this script after users exist.
--
--   3. Run this script against the staging database:
--        psql "postgresql://postgres:[password]@db.[project-ref].supabase.co:5432/postgres" \
--          -f supabase/seed/staging_seed.sql
--
--      Or paste into the Supabase Studio SQL editor (staging project).
--
-- Largely idempotent — all inserts except redemption history use ON CONFLICT guards.
-- Redemption history rows (section 6) are plain INSERTs: the redemptions table has no
-- unique constraint by design, and duplicate history rows are acceptable test data.
-- DO NOT run in production.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Promote users
--    The handle_new_user trigger already created profiles rows on signup.
--    We update role and display name here.
-- ─────────────────────────────────────────────────────────────────────────────

update profiles set role = 'admin',        full_name = 'BOL Admin'
where email = 'admin@betterofflocal.test';

update profiles set role = 'retailer_user', full_name = 'Old Mill Café'
where email = 'retailer@betterofflocal.test';

update profiles set role = 'retailer_user', full_name = 'Alloa Books'
where email = 'retailer2@betterofflocal.test';

update profiles set full_name = 'Test Consumer'
where email = 'consumer@betterofflocal.test';

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Live retailer — The Old Mill Café
--    approval_status=approved, visibility_status=live, active subscription.
--    Represents a fully onboarded, paying, publicly visible retailer.
-- ─────────────────────────────────────────────────────────────────────────────

insert into retailers (
  id, name, slug, email, phone,
  short_description, tagline, business_type,
  approval_status, visibility_status, is_active,
  onboarding_step, submitted_at,
  stripe_customer_id  -- null: seed row, no real Stripe customer
) values (
  '00000000-0000-0000-0001-000000000001',
  'The Old Mill Café',
  'the-old-mill-cafe',
  'hello@oldmillcafe.example.com',
  '01259 000001',
  'A cosy café in the heart of Alloa, serving locally sourced food and great coffee.',
  'Local food, great coffee',
  'Cafes',
  'approved',
  'live',
  true,
  'submitted',
  now(),
  null
) on conflict (id) do update set
  approval_status    = excluded.approval_status,
  visibility_status  = excluded.visibility_status,
  is_active          = excluded.is_active,
  stripe_customer_id = null;

insert into retailer_locations (
  id, retailer_id, name, address_line_1, town, postcode,
  latitude, longitude, is_primary, is_active
) values (
  '00000000-0000-0000-0003-000000000001',
  '00000000-0000-0000-0001-000000000001',
  'Alloa Branch',
  '12 Mill Street',
  'Alloa',
  'FK10 1AA',
  56.1167, -3.7925,
  true, true
) on conflict (id) do nothing;

insert into retailer_users (retailer_id, profile_id, access_role, is_active)
select
  '00000000-0000-0000-0001-000000000001',
  id, 'owner', true
from profiles
where email = 'retailer@betterofflocal.test'
on conflict (retailer_id, profile_id) do nothing;

insert into retailer_categories (retailer_id, category_id)
select '00000000-0000-0000-0001-000000000001', id
from categories where slug = 'cafes'
on conflict (retailer_id, category_id) do nothing;

-- Active retailer subscription — no real Stripe subscription (seed row).
-- current_period_end set 1 year out so billing checks pass.
insert into retailer_subscriptions (
  id, retailer_id,
  status, billing_interval,
  current_period_start, current_period_end, started_at,
  stripe_subscription_id, stripe_price_id
) values (
  '00000000-0000-0000-0005-000000000001',
  '00000000-0000-0000-0001-000000000001',
  'active', 'annual',
  now(), now() + interval '1 year', now(),
  null, null
) on conflict (id) do update set
  status             = excluded.status,
  current_period_end = excluded.current_period_end;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Hidden retailer — Alloa Books
--    approval_status=approved, visibility_status=hidden, no active subscription.
--    Exercises the "Not activated" admin dashboard tab and the billing
--    activation flow in the retailer portal.
-- ─────────────────────────────────────────────────────────────────────────────

insert into retailers (
  id, name, slug, email, phone,
  short_description, tagline, business_type,
  approval_status, visibility_status, is_active,
  onboarding_step, submitted_at,
  stripe_customer_id
) values (
  '00000000-0000-0000-0001-000000000002',
  'Alloa Books',
  'alloa-books',
  'hello@alloabooks.example.com',
  '01259 000002',
  'Independent bookshop with a wide selection of new and second-hand titles.',
  'Books, gifts & stationery',
  'Shopping',
  'approved',
  'hidden',
  true,
  'submitted',
  now() - interval '2 days',
  null
) on conflict (id) do update set
  approval_status    = excluded.approval_status,
  visibility_status  = excluded.visibility_status,
  is_active          = excluded.is_active,
  stripe_customer_id = null;

insert into retailer_locations (
  id, retailer_id, name, address_line_1, town, postcode,
  latitude, longitude, is_primary, is_active
) values (
  '00000000-0000-0000-0003-000000000002',
  '00000000-0000-0000-0001-000000000002',
  'Alloa Branch',
  '7 Drysdale Street',
  'Alloa',
  'FK10 1JA',
  56.1185, -3.7910,
  true, true
) on conflict (id) do nothing;

insert into retailer_users (retailer_id, profile_id, access_role, is_active)
select
  '00000000-0000-0000-0001-000000000002',
  id, 'owner', true
from profiles
where email = 'retailer2@betterofflocal.test'
on conflict (retailer_id, profile_id) do nothing;

insert into retailer_categories (retailer_id, category_id)
select '00000000-0000-0000-0001-000000000002', id
from categories where slug = 'shopping'
on conflict (retailer_id, category_id) do nothing;

-- No retailer_subscriptions row for Alloa Books — intentional.
-- This is the "approved but not yet activated" state tested in checklist step 4.

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Offers for The Old Mill Café
-- ─────────────────────────────────────────────────────────────────────────────

insert into offers (
  id, retailer_id,
  title, short_summary, value_text,
  offer_type, status, is_featured, approval_required
) values (
  '00000000-0000-0000-0002-000000000001',
  '00000000-0000-0000-0001-000000000001',
  '10% off all hot drinks',
  'Show your membership QR for 10% off any hot drink.',
  '10% off',
  'percentage_discount', 'live', true, false
),
(
  '00000000-0000-0000-0002-000000000002',
  '00000000-0000-0000-0001-000000000001',
  'Free slice of cake with any lunch',
  'Buy any lunch main and get a free slice of homemade cake.',
  'Free cake',
  'free_item', 'live', false, false
)
on conflict (id) do nothing;

-- Per-day limit on the featured offer — enables checklist test case 10d
-- (daily limit reached) without extra manual DB edits.
insert into offer_rules (offer_id, max_redemptions_per_day)
values ('00000000-0000-0000-0002-000000000001', 1)
on conflict (offer_id) do nothing;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Consumer membership
--    status=active, current_period_end 1 year out.
--    stripe_customer_id and stripe_subscription_id are null (seed row —
--    no real Stripe objects). The consumer can redeem offers immediately.
--    To test the real Stripe checkout flow, sign up with a second account
--    and complete checklist step 5 end-to-end.
-- ─────────────────────────────────────────────────────────────────────────────

insert into consumer_memberships (
  id, profile_id,
  status, plan_interval,
  current_period_start, current_period_end, started_at,
  stripe_customer_id, stripe_subscription_id
)
select
  '00000000-0000-0000-0004-000000000001',
  id,
  'active', 'annual',
  now(), now() + interval '1 year', now(),
  null, null  -- seed row, no real Stripe subscription
from profiles
where email = 'consumer@betterofflocal.test'
on conflict (id) do update set
  status             = excluded.status,
  current_period_end = excluded.current_period_end;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. Sample redemption history
--    Two past redemptions for the consumer against the featured offer.
--    Populates the redemption history screen without requiring a real scan.
--    redemption_token_id is null — permitted by schema.
-- ─────────────────────────────────────────────────────────────────────────────

insert into redemptions (
  profile_id, retailer_id, retailer_location_id, offer_id,
  redemption_token_id, status, redeemed_at
)
select
  p.id,
  '00000000-0000-0000-0001-000000000001',
  '00000000-0000-0000-0003-000000000001',
  '00000000-0000-0000-0002-000000000001',
  null,
  'success',
  now() - interval '7 days'
from profiles p
where p.email = 'consumer@betterofflocal.test';

insert into redemptions (
  profile_id, retailer_id, retailer_location_id, offer_id,
  redemption_token_id, status, redeemed_at
)
select
  p.id,
  '00000000-0000-0000-0001-000000000001',
  '00000000-0000-0000-0003-000000000001',
  '00000000-0000-0000-0002-000000000001',
  null,
  'success',
  now() - interval '30 days'
from profiles p
where p.email = 'consumer@betterofflocal.test';
