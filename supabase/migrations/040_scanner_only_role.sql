-- 040_scanner_only_role.sql
-- Add scanner_only access role for retailer staff who should only see
-- the QR scan page. Owner creates staff accounts via the Settings page;
-- staff log in on their own phone and are restricted to /scan.

alter type retailer_access_role add value if not exists 'scanner_only';
