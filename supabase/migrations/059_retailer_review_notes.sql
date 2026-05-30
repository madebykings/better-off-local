-- 059_retailer_review_notes.sql
-- Adds review_notes to retailers so admin feedback on changes_requested
-- is visible in the retailer portal without relying on email delivery.

alter table retailers
  add column review_notes text;

comment on column retailers.review_notes is
  'Admin feedback from the most recent changes_requested action.
   Cleared on approval or rejection. Displayed in the retailer portal.';
