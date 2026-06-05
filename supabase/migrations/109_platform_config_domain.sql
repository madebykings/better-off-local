-- 109_platform_config_domain.sql
-- Canonical public domain is betterofflocal.co.uk.
-- Migration 070 seeded homepage_cta_url with the .com variant; correct it here.
-- The ALTER DEFAULT ensures all future rows use the right domain.

alter table platform_config
  alter column homepage_cta_url
  set default 'https://betterofflocal.co.uk/join';

update platform_config
   set homepage_cta_url = 'https://betterofflocal.co.uk/join'
 where homepage_cta_url = 'https://betterofflocal.com/join';
