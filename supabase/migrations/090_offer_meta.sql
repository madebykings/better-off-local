-- 090_offer_meta.sql
-- Adds JSONB structured content to offers for type-specific display fields.
-- All existing offers keep offer_meta = null and continue working unchanged.
-- These fields are display-focused only — not used for redemption enforcement.

alter table offers add column if not exists offer_meta jsonb;

comment on column offers.offer_meta is
  'Type-specific display fields. Keys vary by offer_type:
   percentage_discount → {applies_to?, min_spend?}
   fixed_discount      → {min_spend?}
   free_item           → {free_item_name?, qualifying_purchase?}
   buy_one_get_one     → {buy_item?, receive_item?}
   meal_deal           → {bundle_price?, included_items?: string[]}
   Display-focused only — not used for redemption enforcement.
   Admin editing of offer_meta is a follow-up (see Phase 4 notes).';
