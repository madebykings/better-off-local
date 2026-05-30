-- 051_offer_venues.sql
-- Multi-venue offer assignment.
--
-- Adds venue_scope to offers and a junction table offer_locations.
-- offers.retailer_location_id was added in Batch 2 for single-venue selection
-- but is now superseded. It is nulled here and deprecated in favour of the
-- junction table, which supports all / specific-venue scoping cleanly.
--
-- venue_scope values:
--   'all'      — offer applies to every active location (default)
--   'specific' — offer applies only to locations listed in offer_locations

alter table offers
  add column venue_scope text not null default 'all'
  constraint offers_venue_scope_check check (venue_scope in ('all', 'specific'));

comment on column offers.venue_scope is
  'Venue applicability. all = every retailer location. specific = see offer_locations.';

-- Clear and deprecate the old single-location FK.
update offers set retailer_location_id = null;

comment on column offers.retailer_location_id is
  'Deprecated in migration 051. Use venue_scope + offer_locations instead. Retained for audit trail.';

-- Junction table: one row per (offer, location) assignment.
create table offer_locations (
  offer_id             uuid not null references offers(id) on delete cascade,
  retailer_location_id uuid not null references retailer_locations(id) on delete cascade,
  created_at           timestamptz not null default now(),
  primary key (offer_id, retailer_location_id)
);

comment on table offer_locations is
  'Explicit location assignments for offers with venue_scope = ''specific''.';
