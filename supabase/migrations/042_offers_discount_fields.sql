-- 042_offers_discount_fields.sql
-- Adds financial metadata to offers for the deferred "estimated value delivered"
-- analytics metric and retailer reporting.
--
-- discount_type is NOT added: offers.offer_type already captures this
-- (percentage_discount, fixed_discount, free_item, bundle, other).
--
-- discount_value: the numeric value of the discount.
--   fixed_discount  → pound amount (e.g. 2.50 for "£2.50 off")
--   percentage_discount → percentage points (e.g. 20 for "20% off")
--   free_item       → null (use retail_value instead)
--   bundle / other  → retailer-defined; optional
--
-- retail_value: the retail price of the item for free_item offers.
--   Used when calculating estimated member value for free-item offers.
--   Retailer-supplied; nullable because retailers may not know or supply it.
--   Not used for percentage or fixed offers.
--
-- Neither column is required for offer creation. No NOT NULL constraint.
-- The analytics metric that consumes these fields is deferred until
-- transaction-value capture or POS integration exists.

alter table offers
  add column discount_value numeric(10,2),
  add column retail_value   numeric(10,2);

comment on column offers.discount_value is
  'Numeric discount amount. For fixed_discount: pounds. For percentage_discount: percentage points. Null for free_item (use retail_value).';

comment on column offers.retail_value is
  'Retail price of the item for free_item offers. Retailer-supplied, optional. Used for deferred estimated-value-delivered analytics metric.';
