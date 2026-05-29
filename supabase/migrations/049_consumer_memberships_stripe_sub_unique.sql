-- 049_consumer_memberships_stripe_sub_unique.sql
--
-- Fix: Supabase upsert ON CONFLICT (stripe_subscription_id) requires a full
-- unique constraint, not a partial unique index. The partial index created in
-- 022 is not matched by ON CONFLICT (column) without a WHERE predicate, which
-- the Supabase JS client cannot express. This caused every consumer membership
-- upsert to fail with "there is no unique or exclusion constraint matching the
-- ON CONFLICT specification", silently returning 200 to Stripe.
--
-- Replace the partial index with a full unique constraint.
-- PostgreSQL unique constraints still allow multiple NULLs (NULL != NULL), so
-- inactive rows with stripe_subscription_id = NULL continue to coexist freely.

drop index if exists consumer_memberships_stripe_sub_id_idx;

alter table consumer_memberships
  add constraint consumer_memberships_stripe_sub_id_key
  unique (stripe_subscription_id);
