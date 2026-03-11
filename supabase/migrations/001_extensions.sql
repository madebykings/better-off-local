-- 001_extensions.sql
-- Enable required PostgreSQL extensions

create extension if not exists "pgcrypto";

-- PostGIS is recommended for future geospatial queries.
-- Enable only if available in your Supabase project tier.
-- create extension if not exists "postgis";
