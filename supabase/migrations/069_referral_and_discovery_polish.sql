-- 069_referral_and_discovery_polish.sql
-- Pre-launch polish for the referral system and discovery views.
--
-- Changes:
--   1. referral_config table — admin-configurable referral settings.
--      No code changes required to alter reward values.
--   2. referral_rewards.reward_months — tracks months awarded per reward.
--   3. referral_stats view updated — exposes total_reward_months.
--   4. consumer_discovery_retailers view updated — adds active_offer_count.

-- ── 1. Referral configuration ─────────────────────────────────────────────────
-- Single-row config table. Constraint enforces only one row ever exists.

create table referral_config (
  id                    smallint primary key default 1,
  reward_months         smallint not null default 1,   -- months per successful referral (referrer)
  friend_reward_months  smallint not null default 1,   -- months awarded to the friend
  cap_per_year          smallint not null default 12,  -- max reward months per referrer per year
  grace_days            smallint not null default 7,   -- days before reward is confirmed
  annual_credit_months  smallint not null default 1,   -- credit months for annual-plan referrers
  constraint referral_config_single_row check (id = 1)
);

insert into referral_config(id) values (1)
  on conflict (id) do nothing;

comment on table referral_config is
  'Single-row referral programme settings. Edit via admin portal or direct SQL.
   No deployment required to change reward values.';

-- Admin can read and update.
grant select, update on referral_config to service_role;

-- ── 2. referral_rewards.reward_months ─────────────────────────────────────────

alter table referral_rewards
  add column if not exists reward_months smallint not null default 1;

comment on column referral_rewards.reward_months is
  'Months of membership awarded for this reward. Defaults to 1.
   Use referral_config.reward_months when creating new rewards.';

-- ── 3. Update referral_stats view ─────────────────────────────────────────────
-- Adds total_reward_months so the mobile app can display "5 free months earned"
-- without performing arithmetic on pence.

create or replace view referral_stats as
select
  rc.profile_id,
  rc.code,
  count(distinct ri.id)                                                          as invited_count,
  count(distinct ri.id) filter (where rr.id is not null)                         as converted_count,
  count(distinct rr.id) filter (where rr.status = 'pending')                     as pending_rewards,
  count(distinct rr.id) filter (where rr.status in ('confirmed','applied'))       as confirmed_rewards,
  coalesce(sum(rr.reward_amount_pence) filter (where rr.status in ('confirmed','applied')), 0) as total_reward_pence,
  coalesce(sum(rr.reward_months)       filter (where rr.status in ('confirmed','applied')), 0) as total_reward_months,
  coalesce(sum(rr.reward_months) filter (where rr.status = 'pending'), 0)         as pending_months
from referral_codes rc
left join referral_invitations ri on ri.referral_code_id = rc.id
left join referral_rewards rr     on rr.referral_invitation_id = ri.id
group by rc.profile_id, rc.code;

grant select on referral_stats to authenticated;

-- ── 4. consumer_discovery_retailers — add active_offer_count ─────────────────
-- Pattern: DROP + RECREATE (see migration 054 for rationale).
-- Grants are reapplied below.

drop view if exists consumer_discovery_retailers;

create view consumer_discovery_retailers as
  select
    r.id,
    r.name,
    r.slug,
    r.tagline,
    r.description,
    r.short_description,
    r.logo_url,
    r.cover_image_url,
    r.website_url,
    r.phone,
    r.email,
    loc.address_line_1,
    loc.town,
    loc.postcode,
    loc.latitude,
    loc.longitude,
    (
      select count(*)::integer
        from retailer_locations l
       where l.retailer_id = r.id
         and l.is_active = true
    ) as location_count,
    (
      select count(*)::integer
        from offers o
       where o.retailer_id = r.id
         and o.status = 'live'
         and (o.start_at is null or o.start_at <= now())
         and (o.end_at   is null or o.end_at   > now())
    ) as active_offer_count,
    coalesce(
      (
        select json_agg(c.name order by c.sort_order, c.name)
          from retailer_categories rc
          join categories c on c.id = rc.category_id
         where rc.retailer_id = r.id
           and c.is_active = true
      ),
      '[]'::json
    ) as category_names
  from retailers r
  left join retailer_locations loc
    on loc.retailer_id = r.id
   and loc.is_primary = true
  where r.approval_status = 'approved'
    and r.visibility_status = 'live'
    and r.is_active = true;

grant select on consumer_discovery_retailers to anon, authenticated;
