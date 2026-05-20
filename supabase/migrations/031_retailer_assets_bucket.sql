-- 031_retailer_assets_bucket.sql
-- Public storage bucket for retailer branding assets (logos and cover images).
--
-- Files are uploaded via the service-role server action — no client-side
-- Storage writes. RLS write policies are therefore not required; the public
-- bucket setting alone covers reads.
--
-- Path convention: retailer-assets/{retailer_id}/{logo|cover}-{uuid}.webp

insert into storage.buckets (id, name, public)
values ('retailer-assets', 'retailer-assets', true);
