-- 099_notify_offer_live_prefs.sql
-- Fix notify_offer_live() to honour notification_preferences.new_offers.
--
-- The original function (migration 061) sent notifications to ALL retailer
-- favouriters and ALL category followers without checking their preferences.
-- notify_followers_new_offer() (migration 092) already checks preferences for
-- retailer-follow notifications, so this fix brings the other two groups in line.
--
-- Rule: before inserting a notification for a profile
--   • If a notification_preferences row exists and new_offers = false → skip.
--   • If no row exists → default to sending (opt-in by default).
--
-- This is a full CREATE OR REPLACE of notify_offer_live().

create or replace function notify_offer_live()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
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

  -- ── a) Notify retailer favouriters ───────────────────────────────────────
  -- Checks notification_preferences.new_offers; absent row = default true.
  for v_profile_id in
    select f.profile_id
      from favourites f
      left join notification_preferences np on np.profile_id = f.profile_id
     where f.retailer_id = NEW.retailer_id
       and f.offer_id is null
       -- Respect notification preferences (absent row = default true)
       and coalesce(np.new_offers, true) = true
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

  -- ── b) Notify category followers ──────────────────────────────────────────
  -- Checks notification_preferences.new_offers; absent row = default true.
  -- Don't double-notify retailer favouriters.
  for v_profile_id in
    select distinct cf.profile_id
      from category_follows cf
      join retailer_categories rc on rc.category_id = cf.category_id
      left join notification_preferences np on np.profile_id = cf.profile_id
     where rc.retailer_id = NEW.retailer_id
       -- Respect notification preferences (absent row = default true)
       and coalesce(np.new_offers, true) = true
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

-- The trigger (offers_notify_on_live) was created in migration 061 and is
-- already attached to the offers table — no need to recreate it.
-- Grants: the function runs as security definer with service_role privileges;
-- no explicit grant is required for trigger functions.
