-- 061_batch6_discovery_notifications.sql
-- Batch 6: Discovery, Notifications & Region Growth
--
-- 1. category_follows — members follow categories to receive offer alerts
-- 2. Notification creation functions — called from triggers and webhooks
-- 3. Offer-goes-live trigger — notifies retailer favouriters
-- 4. Region milestone trigger — notifies region members on threshold cross
-- 5. RLS for notifications and category_follows
-- 6. region_public_stats — grant anon access for public progress page

-- ── 1. category_follows ───────────────────────────────────────────────────────

create table category_follows (
  profile_id  uuid not null references profiles(id) on delete cascade,
  category_id uuid not null references categories(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (profile_id, category_id)
);

create index category_follows_category_idx on category_follows(category_id);

comment on table category_follows is
  'Members follow categories to receive notifications when new offers are added.';

alter table category_follows enable row level security;

create policy "Member reads own category follows"
  on category_follows for select to authenticated
  using (profile_id = auth.uid());

create policy "Member inserts own category follows"
  on category_follows for insert to authenticated
  with check (profile_id = auth.uid());

create policy "Member deletes own category follows"
  on category_follows for delete to authenticated
  using (profile_id = auth.uid());

-- ── 2. RLS for notifications ──────────────────────────────────────────────────

alter table notifications enable row level security;

create policy "Member reads own notifications"
  on notifications for select to authenticated
  using (profile_id = auth.uid());

create policy "Member updates own notifications"
  on notifications for update to authenticated
  using (profile_id = auth.uid());

-- service_role can insert notifications for any member (no RLS restriction)

-- ── 3. Notification helper: insert_notification ───────────────────────────────
-- Inserts a single in-app notification. Idempotent key via data_json.
-- Called from triggers and edge functions.

create or replace function insert_notification(
  p_profile_id  uuid,
  p_type        text,
  p_title       text,
  p_body        text,
  p_data_json   jsonb default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into notifications(profile_id, type, title, body, data_json)
  values (p_profile_id, p_type, p_title, p_body, p_data_json);
end;
$$;

revoke execute on function insert_notification(uuid, text, text, text, jsonb) from public, anon, authenticated;
grant  execute on function insert_notification(uuid, text, text, text, jsonb) to service_role;

-- ── 4. Offer-goes-live trigger ────────────────────────────────────────────────
-- When an offer transitions to status='live', fan out a notification to:
--   a) All members who have favourited the retailer
--   b) All members following a category the retailer belongs to

create or replace function notify_offer_live()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_offer       offers%rowtype;
  v_retailer    retailers%rowtype;
  v_notif_body  text;
  v_profile_id  uuid;
begin
  -- Only fire on live transition
  if not (NEW.status = 'live' and (OLD.status is null or OLD.status <> 'live')) then
    return NEW;
  end if;

  select * into v_retailer from retailers where id = NEW.retailer_id;

  v_notif_body := coalesce(NEW.value_text || ' — ' || NEW.title, NEW.title);

  -- a) Notify retailer favouriters
  for v_profile_id in
    select f.profile_id
      from favourites f
     where f.retailer_id = NEW.retailer_id
       and f.offer_id is null
       -- Only notify members with active memberships
       and exists (
         select 1 from consumer_memberships cm
          where cm.profile_id = f.profile_id
            and cm.status in ('active', 'trialing')
            and cm.current_period_end > now()
       )
  loop
    perform insert_notification(
      v_profile_id,
      'offer',
      'New offer from ' || coalesce(v_retailer.name, 'a retailer you follow'),
      v_notif_body,
      jsonb_build_object('offer_id', NEW.id, 'retailer_id', NEW.retailer_id)
    );
  end loop;

  -- b) Notify category followers (for categories this retailer belongs to)
  for v_profile_id in
    select distinct cf.profile_id
      from category_follows cf
      join retailer_categories rc on rc.category_id = cf.category_id
     where rc.retailer_id = NEW.retailer_id
       -- Don't double-notify retailer favouriters
       and not exists (
         select 1 from favourites f
          where f.profile_id = cf.profile_id
            and f.retailer_id = NEW.retailer_id
            and f.offer_id is null
       )
       and exists (
         select 1 from consumer_memberships cm
          where cm.profile_id = cf.profile_id
            and cm.status in ('active', 'trialing')
            and cm.current_period_end > now()
       )
  loop
    perform insert_notification(
      v_profile_id,
      'offer',
      'New offer in a category you follow',
      coalesce(v_retailer.name, 'A local business') || ': ' || v_notif_body,
      jsonb_build_object('offer_id', NEW.id, 'retailer_id', NEW.retailer_id)
    );
  end loop;

  return NEW;
end;
$$;

create trigger offers_notify_on_live
  after insert or update of status on offers
  for each row
  execute function notify_offer_live();

-- ── 5. Referral reward notification ──────────────────────────────────────────
-- Called from the stripe-webhook after applying a referral credit.

create or replace function notify_referral_reward(
  p_referrer_profile_id uuid,
  p_reward_amount_pence integer
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_pounds text;
begin
  v_pounds := '£' || (p_reward_amount_pence / 100.0)::numeric(10,2)::text;
  perform insert_notification(
    p_referrer_profile_id,
    'referral',
    'Your referral reward is on its way!',
    'A friend joined Better Off Local using your link. We''ve applied a ' || v_pounds || ' credit to your next bill.',
    jsonb_build_object('reward_amount_pence', p_reward_amount_pence)
  );
end;
$$;

grant execute on function notify_referral_reward(uuid, integer) to service_role;

-- ── 6. Region milestone notification ─────────────────────────────────────────
-- Called manually or from a scheduled job when a region hits its threshold.

create or replace function notify_region_milestone(p_region_id uuid)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_region    regions%rowtype;
  v_count     integer := 0;
  v_profile   uuid;
begin
  select * into v_region from regions where id = p_region_id;
  if not found then return 0; end if;

  for v_profile in
    select p.id
      from profiles p
      join consumer_memberships cm on cm.profile_id = p.id
     where p.region_id = p_region_id
       and cm.status in ('active', 'trialing')
       and cm.current_period_end > now()
  loop
    perform insert_notification(
      v_profile,
      'region',
      v_region.name || ' has reached ' || v_region.member_threshold || ' members!',
      'Local retailers in ' || v_region.name || ' are now part of the network. Explore new offers near you.',
      jsonb_build_object('region_id', p_region_id, 'region_name', v_region.name)
    );
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

grant execute on function notify_region_milestone(uuid) to service_role;

-- ── 7. Public access to region_public_stats ───────────────────────────────────
-- Required for the public region progress page (unauthenticated access).

grant select on region_public_stats to anon;

-- ── 8. Membership expiry notification function ────────────────────────────────
-- Intended to be called by a scheduled job (e.g. cron, daily).
-- Notifies members whose membership expires within the next N days.

create or replace function notify_expiring_memberships(p_days_before integer default 7)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_count integer := 0;
  v_row   record;
begin
  for v_row in
    select cm.profile_id, cm.current_period_end, cm.cancel_at_period_end
      from consumer_memberships cm
     where cm.status in ('active', 'trialing')
       and cm.current_period_end between now() and now() + (p_days_before * interval '1 day')
       and cm.cancel_at_period_end = true
       -- Don't spam — only notify once per expiry window
       and not exists (
         select 1 from notifications n
          where n.profile_id = cm.profile_id
            and n.type = 'membership'
            and (n.data_json->>'expiry_date')::timestamptz = cm.current_period_end
       )
  loop
    perform insert_notification(
      v_row.profile_id,
      'membership',
      'Your Better Off Local membership is ending soon',
      'Your membership expires on ' ||
        to_char(v_row.current_period_end at time zone 'UTC', 'DD Mon YYYY') ||
        '. Renew now to keep your local discounts.',
      jsonb_build_object('expiry_date', v_row.current_period_end)
    );
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

grant execute on function notify_expiring_memberships(integer) to service_role;
