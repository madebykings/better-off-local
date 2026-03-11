-- 011_redemption_tokens.sql
-- Short-lived tokens used to generate secure consumer QR codes

create table redemption_tokens (
  id                    uuid primary key default gen_random_uuid(),
  profile_id            uuid not null references profiles(id) on delete cascade,
  offer_id              uuid not null references offers(id) on delete cascade,
  retailer_id           uuid not null references retailers(id) on delete cascade,
  retailer_location_id  uuid references retailer_locations(id) on delete set null,
  token_hash            text not null unique,   -- store hashed token only, never plaintext
  expires_at            timestamptz not null,
  consumed_at           timestamptz,
  created_at            timestamptz not null default now()
);
