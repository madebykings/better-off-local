-- 028_membership_pass_tokens.sql
-- Short-lived tokens for the membership pass QR displayed on the consumer Card tab.
--
-- Design notes:
--   - Tokens are NOT single-use. consumed_at is intentionally omitted — membership
--     proof can be re-scanned within its TTL (e.g. retailer checks twice). Single-use
--     semantics apply only to offer redemption_tokens.
--   - Only the SHA-256 hash is stored; the plaintext token is returned once and discarded.
--   - device_fingerprint is optional — stored for soft anti-abuse analysis, never
--     used to gate access.
--   - purpose enum allows future token types (wallet pass, event entry, etc.)
--     without a schema change.
--
-- Validated by: supabase/functions/validate-qr-token

create type pass_token_purpose as enum (
  'membership_pass'
  -- Future: 'wallet_pass', 'event_entry'
);

create table membership_pass_tokens (
  id                  uuid               primary key default gen_random_uuid(),
  profile_id          uuid               not null references profiles(id) on delete cascade,

  -- SHA-256 hex digest of the raw token. Plaintext is never stored.
  -- The raw token is returned to the client once and then discarded.
  token_hash          text               not null unique,

  -- Discriminator for analytics and future routing.
  purpose             pass_token_purpose not null default 'membership_pass',

  -- Optional client-supplied hint for soft anti-abuse analysis.
  -- Not used to gate token validity — purely informational.
  device_fingerprint  text,

  expires_at          timestamptz        not null,
  created_at          timestamptz        not null default now()
);

-- ── Indexes ─────────────────────────────────────────────────────────────────

-- Retailer scanner hot path: lookup by hash on every scan.
create index membership_pass_tokens_hash_idx
  on membership_pass_tokens(token_hash);

-- Expiry cleanup job: find tokens past their TTL for periodic pruning.
create index membership_pass_tokens_expiry_idx
  on membership_pass_tokens(expires_at);

-- Rate-limit enforcement in edge function: count recent tokens per consumer.
create index membership_pass_tokens_profile_created_idx
  on membership_pass_tokens(profile_id, created_at desc);

-- ── Row-level security ───────────────────────────────────────────────────────

alter table membership_pass_tokens enable row level security;

-- All inserts and reads go through edge functions (service role).
-- Consumers never query this table directly — they receive the raw token once.
-- Admins can read for audit and anti-abuse investigation.
create policy "Admins can read membership pass tokens"
  on membership_pass_tokens for select
  using (is_admin());
