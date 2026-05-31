-- 065_category_follows_grants.sql
-- Adds authenticated grants for category_follows.
--
-- RLS and row-scoped policies (SELECT / INSERT / DELETE) were added in 061
-- but no GRANT statements were included. Without table-level grants PostgREST
-- rejects all operations even when the RLS policy would allow them.
--
-- The mobile app performs these operations directly via PostgREST:
--   SELECT — display which categories the member follows
--   INSERT — follow a category
--   DELETE — unfollow a category
--
-- UPDATE is intentionally excluded — category_follows has no mutable columns.
-- Anon access is intentionally excluded — category following requires a membership.

grant select, insert, delete on category_follows to authenticated;
