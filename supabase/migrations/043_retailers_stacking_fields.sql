-- 043_retailers_stacking_fields.sql
-- Adds offer stacking controls to retailers.
--
-- max_offers_per_retailer_per_day
--   Backs the "Allow multiple offers in one visit" retailer setting.
--   NULL  = no cross-offer restriction (platform default, Option C).
--   1     = consumer may only redeem one offer per day at this retailer.
--   The retailer portal maps this to a boolean toggle:
--     [✓] Allow customers to redeem multiple offers in one visit
--   Enabled → NULL. Disabled → 1.
--   Higher values are valid schema-wise for future graduated options.
--   Never expose the raw integer in retailer-facing UI.
--
-- max_offers_per_visit
--   Reserved for future scanner-controlled visit grouping.
--   Not enforced. Not exposed in UI.
--   Will limit offers redeemable within a single scanner_session_id group
--   once the "Add another offer / Finish visit" scanner workflow ships.
--   See: redemptions.scanner_session_id, redemptions.visit_id.

alter table retailers
  add column max_offers_per_retailer_per_day integer,
  add column max_offers_per_visit            integer;

comment on column retailers.max_offers_per_retailer_per_day is
  'Cross-offer daily redemption limit per consumer. NULL = no limit (default). 1 = one offer per day. Backs the retailer portal stacking toggle.';

comment on column retailers.max_offers_per_visit is
  'Reserved. Max offers redeemable within one scanner-confirmed visit (scanner_session_id group). Not enforced until scanner visit workflow ships.';
