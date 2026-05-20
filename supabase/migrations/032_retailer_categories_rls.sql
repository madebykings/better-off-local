-- 032_retailer_categories_rls.sql
-- Add public read policy to retailer_categories.
--
-- RLS was enabled on this table in 018_rls_policies.sql but no policies were
-- defined, so no role could read rows. The consumer app needs to read category
-- assignments when displaying retailer listings.
-- Writes are handled exclusively via service-role server actions.

create policy "public can read retailer categories"
  on retailer_categories for select
  using (true);
