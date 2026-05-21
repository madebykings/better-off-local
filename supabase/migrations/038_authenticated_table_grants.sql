-- 038_authenticated_table_grants.sql
-- Minimum SELECT (and write) privileges for the authenticated role on tables
-- queried directly by the Flutter consumer app.
--
-- Philosophy:
--   - Every grant here is backed by an existing RLS policy that restricts
--     rows to what the user is permitted to see or write.
--   - Tables only accessed via edge functions (redemption_tokens) or
--     admin-portal views (admin_actions, audit_events) are intentionally
--     excluded — no grant means no direct client access even if a bug
--     bypasses RLS.
--   - Write grants (INSERT / UPDATE / DELETE) are scoped to tables where
--     the app performs those operations directly. Server-side mutations
--     (membership creation, subscription management) stay edge-function-only.

-- ── Public discovery tables ───────────────────────────────────────────────────
-- RLS: "Public can read approved live retailers"
grant select on retailers to authenticated;

-- RLS: "Public can read locations of live retailers"
grant select on retailer_locations to authenticated;

-- RLS: "Public can read live offers from active retailers"
grant select on offers to authenticated;

-- RLS: "Anyone can read active categories"
grant select on categories to authenticated;

-- retailer_categories had RLS enabled in migration 018 but no SELECT policy,
-- making it deny-all. The app queries it directly to filter offers by category.
-- We add the missing policy here alongside the grant.
-- RLS: categories for approved live retailers are public information.
create policy "Public can read categories for live retailers"
  on retailer_categories for select
  using (
    exists (
      select 1 from retailers r
      where r.id = retailer_categories.retailer_id
        and r.approval_status = 'approved'
        and r.visibility_status = 'live'
        and r.is_active = true
    )
  );

grant select on retailer_categories to authenticated;

-- ── Consumer account tables ───────────────────────────────────────────────────
-- RLS: "Users can read their own profile"
-- UPDATE intentionally excluded. The existing RLS UPDATE policy (migration 018)
-- has no WITH CHECK clause, meaning any column — including role and is_active —
-- could be changed via a raw PostgREST call. Until that is resolved, direct
-- updates are blocked by withholding the grant.
--
-- TODO: Route profile updates through a server-side edge function that only
-- accepts safe fields: full_name, phone, avatar_url. Add GRANT UPDATE only
-- after that function is in place and the RLS policy is tightened.
grant select on profiles to authenticated;

-- RLS: "Consumers can read their own membership"
-- INSERT/UPDATE intentionally excluded — membership lifecycle is managed
-- exclusively by the create-checkout-session and Stripe webhook edge functions.
grant select on consumer_memberships to authenticated;

-- RLS: "Users can manage their own favourites" (for all)
grant select, insert, delete on favourites to authenticated;

-- RLS: "Users can read their own notifications" / "Users can mark their own notifications read"
grant select, update on notifications to authenticated;

-- RLS: "Consumers can read their own redemption history"
-- Redemption INSERT is handled server-side by the validate-redemption-token
-- edge function — no direct insert grant needed.
grant select on redemptions to authenticated;

-- RLS: "Users can insert their own offer views"
-- SELECT intentionally excluded — the app only writes analytics events,
-- never reads them back. Retailer analytics are portal-only.
grant insert on offer_views to authenticated;

-- RLS: "push_tokens: owner access" (for all)
grant insert, update on push_tokens to authenticated;

-- ── Intentionally excluded ────────────────────────────────────────────────────
-- redemption_tokens  — created/validated by edge functions only; no direct
--                      client access is ever needed.
-- retailer_subscriptions — managed by Stripe webhook edge function only.
-- retailer_users     — not queried by the consumer app.
-- admin_actions      — admin portal only; no user-scoped RLS policy.
-- audit_events       — admin portal only; no user-scoped RLS policy.
