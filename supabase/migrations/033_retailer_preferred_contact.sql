-- 033_retailer_preferred_contact.sql
-- Add preferred_contact_type to retailers.
--
-- Used by the consumer app to determine which contact CTA to feature
-- prominently on the retailer detail screen (e.g. "Call", "WhatsApp",
-- "Email"). Set during the Links onboarding step.
--
-- Valid values match retailer_links.type: 'phone', 'email', 'whatsapp',
-- 'website', 'instagram', 'facebook', 'tiktok'. Not enforced by a DB
-- constraint so new link types can be added without a migration.

alter table retailers
  add column preferred_contact_type text;
