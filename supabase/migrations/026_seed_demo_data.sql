-- 026_seed_demo_data.sql
-- Demo data for development and staging environments only.
-- DO NOT run in production. Guard with an env check where possible.

-- ============================================================
-- Demo retailer
-- ============================================================
insert into retailers (
  id, name, slug, email, phone, website_url,
  short_description, approval_status, visibility_status, is_active
) values (
  '00000000-0000-0000-0001-000000000001',
  'The Old Mill Café',
  'the-old-mill-cafe',
  'hello@oldmillcafe.example.com',
  '01259 000001',
  'https://oldmillcafe.example.com',
  'A cosy café in the heart of Alloa, serving locally sourced food and great coffee.',
  'approved',
  'live',
  true
) on conflict (id) do nothing;

-- Demo retailer location
insert into retailer_locations (
  retailer_id, name, address_line_1, town, postcode,
  latitude, longitude, is_primary, is_active
) values (
  '00000000-0000-0000-0001-000000000001',
  'Alloa Branch',
  '12 Mill Street',
  'Alloa',
  'FK10 1AA',
  56.1167, -3.7925,
  true,
  true
) on conflict do nothing;

-- ============================================================
-- Demo offers
-- ============================================================
insert into offers (
  id, retailer_id, title, short_summary, value_text, offer_type,
  status, is_featured, approval_required
) values
  (
    '00000000-0000-0000-0002-000000000001',
    '00000000-0000-0000-0001-000000000001',
    '10% off all hot drinks',
    'Show your membership card for 10% off any hot drink.',
    '10% off',
    'percentage',
    'live',
    true,
    false
  ),
  (
    '00000000-0000-0000-0002-000000000002',
    '00000000-0000-0000-0001-000000000001',
    'Free slice of cake with any lunch',
    'Buy any lunch main and get a free slice of homemade cake.',
    'Free cake',
    'freebie',
    'live',
    false,
    false
  )
on conflict (id) do nothing;

-- Demo offer rules (one redemption per user per day for drinks)
insert into offer_rules (offer_id, max_redemptions_per_user, max_redemptions_per_day)
values ('00000000-0000-0000-0002-000000000001', 1, null)
on conflict (offer_id) do nothing;
