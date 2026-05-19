-- 027_verification_sessions.sql
-- Verification sessions for online redemption flow.
--
-- A verification session is a short-lived, server-issued token representing a pending
-- membership check on a retailer's website. The BOL widget displays a QR code based on
-- this token. The consumer scans it with the BOL mobile app, which calls the backend to
-- approve the session. The website connector listens for approval and applies a benefit
-- server-side. No discount code is ever exposed.
--
-- See docs/architecture/online-redemption.md for full flow documentation.

create type verification_session_status as enum (
  'pending',
  'approved',
  'rejected',
  'expired',
  'consumed'
);

create type verification_session_platform as enum (
  'widget',
  'woocommerce',
  'shopify',
  'wix',
  'webflow',
  'custom'
);

create table verification_sessions (
  id                    uuid primary key default gen_random_uuid(),

  -- Retailer context
  retailer_id           uuid not null references retailers(id) on delete cascade,

  -- Optional offer scope. Null = retailer-level (any member benefit).
  offer_id              uuid references offers(id) on delete set null,

  -- SHA-256 hash of the raw session token (raw token is never stored).
  session_token_hash    text not null unique,

  -- Session lifecycle state.
  status                verification_session_status not null default 'pending',

  -- Platform that initiated this session.
  platform              verification_session_platform not null,

  -- Optional correlation reference from the host platform (e.g. WooCommerce order ID).
  platform_order_ref    text,

  -- Set when a consumer approves the session.
  consumer_profile_id   uuid references profiles(id) on delete set null,

  -- Session expiry (default 10 minutes, set by edge function at creation time).
  expires_at            timestamptz not null,

  -- Outcome timestamps.
  approved_at           timestamptz,
  rejected_at           timestamptz,

  -- Safe, user-facing rejection reason if applicable.
  rejection_reason      text,

  created_at            timestamptz not null default now()
);

-- Index for widget polling by token hash (the primary hot query path).
create index verification_sessions_token_hash_idx
  on verification_sessions(session_token_hash);

-- Index for expiry cleanup jobs (find pending sessions past their TTL).
create index verification_sessions_expiry_idx
  on verification_sessions(expires_at)
  where status = 'pending';

-- Index for retailer-level analytics and admin queries.
create index verification_sessions_retailer_created_idx
  on verification_sessions(retailer_id, created_at desc);

-- No updated_at column on this table — sessions are effectively immutable once
-- their status changes. Status transitions are append-only via timestamped columns
-- (approved_at, rejected_at). No trigger required.

-- ============================================================
-- Row-level security
-- ============================================================

alter table verification_sessions enable row level security;

-- Retailer users can read sessions for their own retailer.
create policy "Retailer users can read their own verification sessions"
  on verification_sessions for select
  using (
    exists (
      select 1 from retailer_users ru
      where ru.retailer_id = verification_sessions.retailer_id
        and ru.profile_id = auth.uid()
        and ru.is_active = true
    )
  );

-- Consumers can read sessions they approved (for redemption history correlation).
create policy "Consumers can read their own approved sessions"
  on verification_sessions for select
  using (consumer_profile_id = auth.uid());

-- Admins can read all sessions.
create policy "Admins can read all verification sessions"
  on verification_sessions for select
  using (is_admin());

-- All inserts and updates must go through edge functions (service role).
-- No direct client writes are permitted.
