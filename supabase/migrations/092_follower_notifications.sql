-- 092_follower_notifications.sql
-- Business follower notification trigger + notification preferences table.

-- ── 1. notification_preferences ──────────────────────────────────────────────

create table notification_preferences (
  profile_id            uuid primary key references profiles(id) on delete cascade,
  new_offers            boolean not null default true,
  loyalty_programmes    boolean not null default true,
  referral_campaigns    boolean not null default true,
  updated_at            timestamptz not null default now()
);

comment on table notification_preferences is
  'Per-member opt-in/out for in-app notification categories. Absent row = all on.';

alter table notification_preferences enable row level security;

create policy "Member reads own preferences"
  on notification_preferences for select to authenticated
  using (profile_id = auth.uid());

create policy "Member upserts own preferences"
  on notification_preferences for insert to authenticated
  with check (profile_id = auth.uid());

create policy "Member updates own preferences"
  on notification_preferences for update to authenticated
  using (profile_id = auth.uid());

-- ── 2. notify_followers_new_offer trigger ─────────────────────────────────────
-- Fires when an offer transitions to status='live'.
-- Notifies followers of the retailer who have NOT already been notified by
-- notify_offer_live() (which covers favouriters and category followers).

create or replace function notify_followers_new_offer()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_retailer   retailers%rowtype;
  v_notif_body text;
  v_profile_id uuid;
begin
  if not (NEW.status = 'live' and (OLD.status is null or OLD.status <> 'live')) then
    return NEW;
  end if;

  select * into v_retailer from retailers where id = NEW.retailer_id;

  v_notif_body := coalesce(
    v_retailer.name || ' has a new offer: ' || coalesce(NEW.value_text, NEW.title),
    'A business you follow has a new offer'
  );

  for v_profile_id in
    select rf.profile_id
      from retailer_follows rf
      -- Respect notification preferences (absent row = default true)
      left join notification_preferences np on np.profile_id = rf.profile_id
     where rf.retailer_id = NEW.retailer_id
       and coalesce(np.new_offers, true) = true
       -- Only active members
       and exists (
         select 1 from consumer_memberships cm
          where cm.profile_id = rf.profile_id
            and cm.status in ('active', 'trialing')
            and cm.current_period_end > now()
       )
       -- Don't double-notify members already covered by notify_offer_live()
       and not exists (
         select 1 from notifications n
          where n.profile_id = rf.profile_id
            and (n.data_json->>'offer_id') = NEW.id::text
       )
  loop
    perform insert_notification(
      v_profile_id,
      'business_update',
      'New offer from ' || coalesce(v_retailer.name, 'a business you follow'),
      v_notif_body,
      jsonb_build_object('offer_id', NEW.id, 'retailer_id', NEW.retailer_id)
    );
  end loop;

  return NEW;
end;
$$;

create trigger offers_notify_followers
  after insert or update of status on offers
  for each row
  execute function notify_followers_new_offer();

-- Service role already has execute on insert_notification from migration 061.
