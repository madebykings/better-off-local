-- 020_seed_reference_data.sql
-- Seed reference data: initial categories for Clackmannanshire launch

insert into categories (id, name, slug, icon, sort_order, is_active) values
  (gen_random_uuid(), 'Cafes',       'cafes',       'coffee',        1,  true),
  (gen_random_uuid(), 'Restaurants', 'restaurants', 'utensils',      2,  true),
  (gen_random_uuid(), 'Bars',        'bars',        'beer',          3,  true),
  (gen_random_uuid(), 'Beauty',      'beauty',      'sparkles',      4,  true),
  (gen_random_uuid(), 'Fitness',     'fitness',     'dumbbell',      5,  true),
  (gen_random_uuid(), 'Shopping',    'shopping',    'shopping-bag',  6,  true),
  (gen_random_uuid(), 'Services',    'services',    'wrench',        7,  true),
  (gen_random_uuid(), 'Health',      'health',      'heart',         8,  true),
  (gen_random_uuid(), 'Activities',  'activities',  'map',           9,  true),
  (gen_random_uuid(), 'Food & Drink','food-drink',  'fork-knife',    10, true);
