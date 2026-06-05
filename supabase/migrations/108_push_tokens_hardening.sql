-- 108_push_tokens_hardening.sql
-- Two correctness fixes discovered during Phase 18A infrastructure audit.
--
-- 1. push_tokens.is_active column
--    The send-push-notification Edge Function filters on is_active and marks
--    stale tokens inactive, but the column never existed in the schema.
--    Without it the Edge Function returns zero tokens (silent push failure)
--    and cannot deactivate unregistered tokens.
--
-- 2. business_stories authenticated grant
--    Migration 106 created the table and RLS policies but did not grant
--    table-level SELECT to the authenticated role. PostgREST rejects any
--    client query against business_stories regardless of the RLS policy.

-- ── 1. push_tokens: add is_active ─────────────────────────────────────────────

alter table push_tokens
  add column if not exists is_active boolean not null default true;

comment on column push_tokens.is_active is
  'False when the token has been deregistered (FCM UNREGISTERED/INVALID_ARGUMENT). '
  'send-push-notification marks stale tokens inactive instead of deleting them '
  'to preserve audit history.';

create index if not exists push_tokens_active_idx
  on push_tokens (profile_id, is_active)
  where is_active = true;

-- ── 2. business_stories: grant read/write access to authenticated role ─────────
-- RLS policies already restrict rows to the right users; this grant makes them
-- reachable. service_role bypasses RLS so no explicit grant is needed for it.

grant select                       on business_stories to authenticated;
grant insert, update, delete       on business_stories to authenticated;
