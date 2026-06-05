-- 107_partner_types.sql
-- Adds partner_type to retailers so clubs, charities and community
-- organisations can use the same portal and ecosystem as businesses.
-- All existing rows default to 'business' — no data migration needed.

alter table retailers
  add column if not exists partner_type text not null default 'business'
  check (partner_type in ('business', 'club', 'charity', 'community_group', 'organisation'));

comment on column retailers.partner_type is
  'Classifies the partner: business | club | charity | community_group | organisation. '
  'Controls portal copy and feature priority recommendations. Does not restrict features.';
