-- 066_discovery_events_grant.sql
-- Adds explicit INSERT grant for discovery_events to authenticated and anon.
--
-- discovery_events was created in 021 with RLS enabled and an INSERT policy
-- using "with check (true)". The migration comment states the intent:
-- "Any authenticated or anonymous session may insert their own events."
-- However, no GRANT INSERT was issued, so fire-and-forget analytics inserts
-- from the mobile app silently fail via PostgREST.
--
-- SELECT is intentionally excluded — clients never read analytics events back.
-- Retailer analytics are served through the admin/retailer portal via service_role.
--
-- NOTE: As of 2026-05-31 the table does not exist on the remote database despite
-- migration 021 being present in the history. The DO block below is conditional
-- so this migration does not fail if the table is missing. If discovery_events is
-- recreated or confirmed present, the grant will need re-running (or this migration
-- re-applied after the table exists).

do $$
begin
  if exists (
    select 1 from information_schema.tables
     where table_schema = 'public'
       and table_name   = 'discovery_events'
  ) then
    execute 'grant insert on discovery_events to authenticated, anon';
  end if;
end
$$;
