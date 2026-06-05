-- 103_community_analytics_rpcs.sql
-- Community Hub and Impact Platform analytics RPCs.
--
-- Schema notes confirmed from prior migrations:
--   • retailers.region_id does NOT exist — region is via retailer_locations (is_primary=true)
--   • retailers.visibility_status enum: 'draft','live','hidden'
--   • offers.estimated_saving_pence (integer, nullable)
--   • redemption_status enum: 'success','rejected','expired','rule_blocked','membership_invalid'
--   • loyalty_card_status enum: 'active','completed','claimed','expired'
--   • referral_rewards.referrer_profile_id (direct FK on referral_rewards)
--   • retailer_users (not retailer_team_members)
--   • categories table: id, name, slug (retailer_categories links retailer_id → category_id)
--
-- All RPCs: SECURITY DEFINER, search_path = public pg_temp, granted to authenticated.

-- ── get_community_savings ─────────────────────────────────────────────────────
-- Returns high-level savings and participation stats for a region.
-- Region membership is determined via retailer_locations (is_primary=true, region_id).

create or replace function get_community_savings(p_region_id uuid)
returns table(
  total_savings_pence          bigint,
  redemption_count             bigint,
  active_member_count          bigint,
  participating_retailer_count bigint
)
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select
    -- Total estimated savings from successful redemptions in this region
    coalesce(
      (
        select sum(coalesce(o.estimated_saving_pence, 0))
          from redemptions r
          join offers o on o.id = r.offer_id
          join retailers ret on ret.id = o.retailer_id
          join retailer_locations rl
            on rl.retailer_id = ret.id and rl.is_primary = true
         where r.status = 'success'
           and rl.region_id = p_region_id
      ), 0
    )::bigint as total_savings_pence,

    -- Count of successful redemptions for offers in this region
    coalesce(
      (
        select count(*)
          from redemptions r
          join offers o on o.id = r.offer_id
          join retailers ret on ret.id = o.retailer_id
          join retailer_locations rl
            on rl.retailer_id = ret.id and rl.is_primary = true
         where r.status = 'success'
           and rl.region_id = p_region_id
      ), 0
    )::bigint as redemption_count,

    -- Active/trialing memberships platform-wide (no region on consumer_memberships;
    -- only one launch region initially so all active members are counted).
    coalesce(
      (
        select count(distinct profile_id)
          from consumer_memberships
         where status in ('active','trialing')
      ), 0
    )::bigint as active_member_count,

    -- Retailers with at least one live offer in this region
    coalesce(
      (
        select count(distinct ret.id)
          from retailers ret
          join retailer_locations rl
            on rl.retailer_id = ret.id and rl.is_primary = true
          join offers o on o.retailer_id = ret.id
         where rl.region_id = p_region_id
           and o.status = 'live'
      ), 0
    )::bigint as participating_retailer_count;
$$;

grant execute on function get_community_savings(uuid) to authenticated;

-- ── get_community_highlights ──────────────────────────────────────────────────
-- Returns up to 5 named highlights for a region's community hub screen.

create or replace function get_community_highlights(p_region_id uuid)
returns table(
  highlight_type text,
  label          text,
  value_text     text,
  metadata       jsonb
)
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  -- 1. Most redeemed offer overall
  (
    select
      'most_redeemed_offer'::text,
      'Most redeemed'::text,
      o.title,
      jsonb_build_object(
        'offer_id',       o.id::text,
        'retailer_name',  ret.name,
        'count',          count(r.id)
      )
    from redemptions r
    join offers o on o.id = r.offer_id
    join retailers ret on ret.id = o.retailer_id
    join retailer_locations rl
      on rl.retailer_id = ret.id and rl.is_primary = true
    where r.status = 'success'
      and rl.region_id = p_region_id
    group by o.id, o.title, ret.name
    order by count(r.id) desc
    limit 1
  )

  union all

  -- 2. Most popular retailer in last 30 days
  (
    select
      'most_popular_retailer'::text,
      'Most popular this month'::text,
      ret.name,
      jsonb_build_object(
        'retailer_id',    ret.id::text,
        'count',          count(r.id)
      )
    from redemptions r
    join offers o on o.id = r.offer_id
    join retailers ret on ret.id = o.retailer_id
    join retailer_locations rl
      on rl.retailer_id = ret.id and rl.is_primary = true
    where r.status = 'success'
      and rl.region_id = p_region_id
      and r.redeemed_at >= now() - interval '30 days'
    group by ret.id, ret.name
    order by count(r.id) desc
    limit 1
  )

  union all

  -- 3. Most completed loyalty card offer
  (
    select
      'most_completed_loyalty'::text,
      'Most popular loyalty card'::text,
      o.title,
      jsonb_build_object(
        'offer_id',       o.id::text,
        'retailer_name',  ret.name,
        'count',          count(lc.id)
      )
    from loyalty_cards lc
    join offers o on o.id = lc.offer_id
    join retailers ret on ret.id = lc.retailer_id
    join retailer_locations rl
      on rl.retailer_id = ret.id and rl.is_primary = true
    where lc.status in ('completed','claimed')
      and rl.region_id = p_region_id
    group by o.id, o.title, ret.id, ret.name
    order by count(lc.id) desc
    limit 1
  )

  union all

  -- 4. Most followed retailer in region
  (
    select
      'most_followed_retailer'::text,
      'Most followed'::text,
      ret.name,
      jsonb_build_object(
        'retailer_id',    ret.id::text,
        'count',          count(rf.profile_id)
      )
    from retailer_follows rf
    join retailers ret on ret.id = rf.retailer_id
    join retailer_locations rl
      on rl.retailer_id = ret.id and rl.is_primary = true
    where rl.region_id = p_region_id
    group by ret.id, ret.name
    order by count(rf.profile_id) desc
    limit 1
  )

  union all

  -- 5. Busiest month in last 12 months
  (
    select
      'most_active_month'::text,
      'Busiest month'::text,
      to_char(date_trunc('month', r.redeemed_at), 'Month YYYY'),
      jsonb_build_object(
        'month', to_char(date_trunc('month', r.redeemed_at), 'YYYY-MM'),
        'count', count(r.id)
      )
    from redemptions r
    join offers o on o.id = r.offer_id
    join retailers ret on ret.id = o.retailer_id
    join retailer_locations rl
      on rl.retailer_id = ret.id and rl.is_primary = true
    where r.status = 'success'
      and rl.region_id = p_region_id
      and r.redeemed_at >= now() - interval '12 months'
    group by date_trunc('month', r.redeemed_at)
    order by count(r.id) desc
    limit 1
  );
$$;

grant execute on function get_community_highlights(uuid) to authenticated;

-- ── get_community_activity ────────────────────────────────────────────────────
-- Returns recent community activity feed for a region (no user-generated content).

create or replace function get_community_activity(p_region_id uuid, p_limit int default 15)
returns table(
  activity_type text,
  title         text,
  subtitle      text,
  icon_hint     text,
  occurred_at   timestamptz
)
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select activity_type, title, subtitle, icon_hint, occurred_at
  from (
    -- New live events in this region
    select
      'new_event'::text                   as activity_type,
      e.title                             as title,
      ret.name                            as subtitle,
      'event'::text                       as icon_hint,
      e.created_at                        as occurred_at
    from events e
    join retailers ret on ret.id = e.retailer_id
    where e.region_id = p_region_id
      and e.status = 'live'

    union all

    -- New visible retailers in this region
    select
      'new_retailer'::text                as activity_type,
      ret.name                            as title,
      coalesce(
        (
          select c.name
            from retailer_categories rc
            join categories c on c.id = rc.category_id
           where rc.retailer_id = ret.id
           order by c.sort_order
           limit 1
        ),
        'Local business'
      )                                   as subtitle,
      'store'::text                       as icon_hint,
      ret.created_at                      as occurred_at
    from retailers ret
    join retailer_locations rl
      on rl.retailer_id = ret.id and rl.is_primary = true
    where rl.region_id = p_region_id
      and ret.visibility_status = 'live'
      and ret.is_active = true
      and ret.approval_status = 'approved'

    union all

    -- Loyalty milestones: offers where members completed their card in last 7 days
    -- Returns the offer with the most completions in that window.
    (
      select
        'loyalty_milestone'::text           as activity_type,
        o.title                             as title,
        count(lc.id)::text || ' members completed their loyalty card' as subtitle,
        'loyalty'::text                     as icon_hint,
        max(lc.completed_at)                as occurred_at
      from loyalty_cards lc
      join offers o on o.id = lc.offer_id
      join retailers ret on ret.id = lc.retailer_id
      join retailer_locations rl
        on rl.retailer_id = ret.id and rl.is_primary = true
      where lc.status in ('completed','claimed')
        and lc.completed_at >= now() - interval '7 days'
        and rl.region_id = p_region_id
      group by o.id, o.title
      order by count(lc.id) desc
      limit 1
    )

    union all

    -- Recently featured retailers
    select
      'featured_retailer'::text           as activity_type,
      ret.name                            as title,
      'Now featured on Better Off Local'  as subtitle,
      'star'::text                        as icon_hint,
      ret.updated_at                      as occurred_at
    from retailers ret
    join retailer_locations rl
      on rl.retailer_id = ret.id and rl.is_primary = true
    where rl.region_id = p_region_id
      and ret.visibility_status = 'live'
      and ret.is_active = true
      and ret.approval_status = 'approved'
      and ret.updated_at >= now() - interval '30 days'
  ) activity
  order by occurred_at desc
  limit p_limit;
$$;

grant execute on function get_community_activity(uuid, int) to authenticated;

-- ── get_member_impact ─────────────────────────────────────────────────────────
-- Returns an individual consumer's personal impact statistics.

create or replace function get_member_impact(p_consumer_id uuid)
returns table(
  total_saved_pence       bigint,
  offers_redeemed         bigint,
  businesses_supported    bigint,
  loyalty_completions     bigint,
  referrals_generated     bigint,
  events_attended         bigint,
  member_since            timestamptz,
  favourite_retailer_name text,
  favourite_retailer_id   uuid
)
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select
    -- Total estimated savings
    coalesce(
      (
        select sum(coalesce(o.estimated_saving_pence, 0))
          from redemptions r
          join offers o on o.id = r.offer_id
         where r.profile_id = p_consumer_id
           and r.status = 'success'
      ), 0
    )::bigint as total_saved_pence,

    -- Distinct offers redeemed
    coalesce(
      (
        select count(distinct r.offer_id)
          from redemptions r
         where r.profile_id = p_consumer_id
           and r.status = 'success'
      ), 0
    )::bigint as offers_redeemed,

    -- Distinct businesses supported
    coalesce(
      (
        select count(distinct r.retailer_id)
          from redemptions r
         where r.profile_id = p_consumer_id
           and r.status = 'success'
      ), 0
    )::bigint as businesses_supported,

    -- Loyalty completions (completed or claimed)
    coalesce(
      (
        select count(*)
          from loyalty_cards lc
         where lc.profile_id = p_consumer_id
           and lc.status in ('completed','claimed')
      ), 0
    )::bigint as loyalty_completions,

    -- Platform referrals generated by this member
    coalesce(
      (
        select count(*)
          from referral_rewards rr
         where rr.referrer_profile_id = p_consumer_id
      ), 0
    )::bigint as referrals_generated,

    -- Event views as attendance proxy
    coalesce(
      (
        select count(*)
          from event_views ev
         where ev.profile_id = p_consumer_id
      ), 0
    )::bigint as events_attended,

    -- Earliest membership start
    (
      select min(cm.created_at)
        from consumer_memberships cm
       where cm.profile_id = p_consumer_id
    ) as member_since,

    -- Favourite retailer (most redemptions)
    (
      select ret.name
        from redemptions r
        join retailers ret on ret.id = r.retailer_id
       where r.profile_id = p_consumer_id
         and r.status = 'success'
       group by ret.id, ret.name
       order by count(*) desc
       limit 1
    ) as favourite_retailer_name,

    (
      select r.retailer_id
        from redemptions r
       where r.profile_id = p_consumer_id
         and r.status = 'success'
       group by r.retailer_id
       order by count(*) desc
       limit 1
    ) as favourite_retailer_id;
$$;

grant execute on function get_member_impact(uuid) to authenticated;

-- ── get_region_impact ─────────────────────────────────────────────────────────
-- Returns aggregated impact stats for an entire region.

create or replace function get_region_impact(p_region_id uuid)
returns table(
  total_savings_pence      bigint,
  total_redemptions        bigint,
  active_members           bigint,
  businesses_participating bigint,
  events_hosted            bigint,
  loyalty_completions      bigint,
  referrals_generated      bigint,
  monthly_redemptions      jsonb,
  top_businesses           jsonb,
  top_categories           jsonb
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_monthly_redemptions jsonb;
  v_top_businesses      jsonb;
  v_top_categories      jsonb;
begin
  -- Monthly redemptions: last 12 months
  select coalesce(
    jsonb_agg(
      jsonb_build_object('month', month, 'count', cnt)
      order by month
    ),
    '[]'::jsonb
  ) into v_monthly_redemptions
  from (
    select
      to_char(date_trunc('month', r.redeemed_at), 'YYYY-MM') as month,
      count(*) as cnt
    from redemptions r
    join offers o on o.id = r.offer_id
    join retailers ret on ret.id = o.retailer_id
    join retailer_locations rl
      on rl.retailer_id = ret.id and rl.is_primary = true
    where r.status = 'success'
      and rl.region_id = p_region_id
      and r.redeemed_at >= now() - interval '12 months'
    group by date_trunc('month', r.redeemed_at)
  ) m;

  -- Top 5 businesses by redemption count
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'retailer_id',      retailer_id::text,
        'name',             name,
        'redemption_count', cnt
      )
      order by cnt desc
    ),
    '[]'::jsonb
  ) into v_top_businesses
  from (
    select
      ret.id as retailer_id,
      ret.name,
      count(r.id) as cnt
    from redemptions r
    join offers o on o.id = r.offer_id
    join retailers ret on ret.id = o.retailer_id
    join retailer_locations rl
      on rl.retailer_id = ret.id and rl.is_primary = true
    where r.status = 'success'
      and rl.region_id = p_region_id
    group by ret.id, ret.name
    order by cnt desc
    limit 5
  ) tb;

  -- Top 5 categories by redemption count
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'category_name',    category_name,
        'redemption_count', cnt
      )
      order by cnt desc
    ),
    '[]'::jsonb
  ) into v_top_categories
  from (
    select
      c.name as category_name,
      count(r.id) as cnt
    from redemptions r
    join offers o on o.id = r.offer_id
    join retailers ret on ret.id = o.retailer_id
    join retailer_locations rl
      on rl.retailer_id = ret.id and rl.is_primary = true
    join retailer_categories rc on rc.retailer_id = ret.id
    join categories c on c.id = rc.category_id
    where r.status = 'success'
      and rl.region_id = p_region_id
    group by c.name
    order by cnt desc
    limit 5
  ) tc;

  return query
  select
    coalesce(
      (
        select sum(coalesce(o.estimated_saving_pence, 0))
          from redemptions r
          join offers o on o.id = r.offer_id
          join retailers ret on ret.id = o.retailer_id
          join retailer_locations rl
            on rl.retailer_id = ret.id and rl.is_primary = true
         where r.status = 'success'
           and rl.region_id = p_region_id
      ), 0
    )::bigint,

    coalesce(
      (
        select count(*)
          from redemptions r
          join offers o on o.id = r.offer_id
          join retailers ret on ret.id = o.retailer_id
          join retailer_locations rl
            on rl.retailer_id = ret.id and rl.is_primary = true
         where r.status = 'success'
           and rl.region_id = p_region_id
      ), 0
    )::bigint,

    -- Active members platform-wide (no per-region filter on consumer_memberships)
    coalesce(
      (
        select count(distinct profile_id)
          from consumer_memberships
         where status in ('active','trialing')
      ), 0
    )::bigint,

    -- Businesses participating (at least one live offer in region)
    coalesce(
      (
        select count(distinct ret.id)
          from retailers ret
          join retailer_locations rl
            on rl.retailer_id = ret.id and rl.is_primary = true
          join offers o on o.retailer_id = ret.id
         where rl.region_id = p_region_id
           and o.status = 'live'
      ), 0
    )::bigint,

    -- Events hosted (live events in region)
    coalesce(
      (
        select count(*)
          from events e
         where e.region_id = p_region_id
           and e.status = 'live'
      ), 0
    )::bigint,

    -- Loyalty completions for businesses in this region
    coalesce(
      (
        select count(*)
          from loyalty_cards lc
          join retailers ret on ret.id = lc.retailer_id
          join retailer_locations rl
            on rl.retailer_id = ret.id and rl.is_primary = true
         where lc.status in ('completed','claimed')
           and rl.region_id = p_region_id
      ), 0
    )::bigint,

    -- Platform referrals generated (all — no region filter on referral_rewards)
    coalesce(
      (select count(*) from referral_rewards), 0
    )::bigint,

    v_monthly_redemptions,
    v_top_businesses,
    v_top_categories;
end;
$$;

grant execute on function get_region_impact(uuid) to authenticated;

-- ── get_retailer_impact ───────────────────────────────────────────────────────
-- Returns an individual retailer's impact statistics.

create or replace function get_retailer_impact(p_retailer_id uuid)
returns table(
  member_savings_pence bigint,
  total_redemptions    bigint,
  unique_members       bigint,
  loyalty_completions  bigint,
  referrals_generated  bigint,
  follower_count       bigint,
  event_attendance     bigint,
  monthly_redemptions  jsonb
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_monthly jsonb;
begin
  -- Monthly redemptions: last 12 months for this retailer
  select coalesce(
    jsonb_agg(
      jsonb_build_object('month', month, 'count', cnt)
      order by month
    ),
    '[]'::jsonb
  ) into v_monthly
  from (
    select
      to_char(date_trunc('month', r.redeemed_at), 'YYYY-MM') as month,
      count(*) as cnt
    from redemptions r
    where r.retailer_id = p_retailer_id
      and r.status = 'success'
      and r.redeemed_at >= now() - interval '12 months'
    group by date_trunc('month', r.redeemed_at)
  ) m;

  return query
  select
    -- Member savings from this retailer's offers
    coalesce(
      (
        select sum(coalesce(o.estimated_saving_pence, 0))
          from redemptions r
          join offers o on o.id = r.offer_id
         where r.retailer_id = p_retailer_id
           and r.status = 'success'
      ), 0
    )::bigint,

    -- Total successful redemptions
    coalesce(
      (
        select count(*)
          from redemptions r
         where r.retailer_id = p_retailer_id
           and r.status = 'success'
      ), 0
    )::bigint,

    -- Unique members who redeemed
    coalesce(
      (
        select count(distinct r.profile_id)
          from redemptions r
         where r.retailer_id = p_retailer_id
           and r.status = 'success'
      ), 0
    )::bigint,

    -- Loyalty completions at this retailer
    coalesce(
      (
        select count(*)
          from loyalty_cards lc
         where lc.retailer_id = p_retailer_id
           and lc.status in ('completed','claimed')
      ), 0
    )::bigint,

    -- Venue referral rewards generated for this retailer's offers
    -- venue_referral_rewards.offer_id links to offers where retailer_id = p_retailer_id
    coalesce(
      (
        select count(*)
          from venue_referral_rewards vrr
          join offers o on o.id = vrr.offer_id
         where o.retailer_id = p_retailer_id
      ), 0
    )::bigint,

    -- Followers of this retailer
    coalesce(
      (
        select count(*)
          from retailer_follows rf
         where rf.retailer_id = p_retailer_id
      ), 0
    )::bigint,

    -- Event views (attendance proxy) for this retailer's events
    coalesce(
      (
        select count(*)
          from event_views ev
          join events e on e.id = ev.event_id
         where e.retailer_id = p_retailer_id
      ), 0
    )::bigint,

    v_monthly;
end;
$$;

grant execute on function get_retailer_impact(uuid) to authenticated;
