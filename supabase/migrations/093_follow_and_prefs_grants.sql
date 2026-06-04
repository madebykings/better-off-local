-- 093_follow_and_prefs_grants.sql
-- Table-level grants for retailer_follows and notification_preferences.
--
-- RLS policies were created in 091 and 092 but no GRANT statements were
-- included. Without table-level grants PostgREST rejects all operations
-- from the authenticated role before RLS is even evaluated.
-- Pattern: same as 065_category_follows_grants.sql.

-- retailer_follows: consumers follow/unfollow businesses; no UPDATE needed
-- (followed_at is set by DB default; the only writable action is insert/delete).
grant select, insert, delete on retailer_follows to authenticated;

-- notification_preferences: consumers read and upsert their own preferences.
-- UPDATE is required because upsert with ON CONFLICT executes an UPDATE
-- when a preferences row already exists for the profile.
grant select, insert, update on notification_preferences to authenticated;
