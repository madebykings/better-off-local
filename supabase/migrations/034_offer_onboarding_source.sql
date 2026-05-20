-- 034_offer_onboarding_source.sql
-- Tracks which onboarding flow created an offer.
--
-- Used to identify the first offer a retailer created during onboarding so it
-- can be pre-filled on return to the first-offer step.
--
-- Value 'first-offer' is written by the retailer portal onboarding action.
-- Kept as text (not enum) so future flows can add values without migrations.

alter table offers
  add column onboarding_source text;
