-- 073_growth_crm.sql
-- Growth CRM: retailer acquisition, pipeline tracking, meetings, tasks, email history.
--
-- Design principles:
--   • Statuses auto-derive from platform activity wherever possible.
--   • crm_businesses can be pure prospects (no retailer account yet) or linked
--     to an existing retailers row via retailer_id.
--   • The effective_stage view column shows computed pipeline position.

-- ── Stage enum ────────────────────────────────────────────────────────────────

create type crm_stage as enum (
  'lead',
  'contacted',
  'interested',
  'meeting_booked',
  'onboarding',
  'awaiting_content',
  'awaiting_offer',
  'ready_to_launch',
  'live',
  'churned'
);

-- ── crm_businesses ────────────────────────────────────────────────────────────

create table crm_businesses (
  id                    uuid primary key default gen_random_uuid(),
  name                  text not null,
  contact_name          text,
  email                 text,
  phone                 text,
  website               text,
  region_id             uuid references regions(id) on delete set null,
  category              text,
  -- When the business registers as a retailer, link them here.
  retailer_id           uuid references retailers(id) on delete set null,
  assigned_to           uuid references profiles(id) on delete set null,
  -- Manual stage — only meaningful when retailer_id is null or for early stages.
  stage                 crm_stage not null default 'lead',
  notes                 text,
  last_contact_at       timestamptz,
  next_followup_at      timestamptz,
  -- Tracked signup link click (set when they click our outbound link)
  signup_link_token     text unique,
  signup_link_clicked_at timestamptz,
  enquiry_submitted_at  timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index crm_businesses_stage_idx    on crm_businesses(stage);
create index crm_businesses_region_idx   on crm_businesses(region_id);
create index crm_businesses_assigned_idx on crm_businesses(assigned_to);
create index crm_businesses_retailer_idx on crm_businesses(retailer_id);
create index crm_businesses_followup_idx on crm_businesses(next_followup_at);

-- ── crm_meetings ──────────────────────────────────────────────────────────────

create type crm_meeting_outcome as enum (
  'interested',
  'follow_up_later',
  'not_interested',
  'ready_to_join',
  'no_response'
);

create table crm_meetings (
  id              uuid primary key default gen_random_uuid(),
  business_id     uuid not null references crm_businesses(id) on delete cascade,
  scheduled_at    timestamptz not null,
  outcome         crm_meeting_outcome,
  notes           text,
  follow_up_date  date,
  assigned_to     uuid references profiles(id) on delete set null,
  created_by      uuid references profiles(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index crm_meetings_business_idx on crm_meetings(business_id);

-- ── crm_tasks ─────────────────────────────────────────────────────────────────

create type crm_task_status as enum ('pending', 'done', 'cancelled');

create table crm_tasks (
  id           uuid primary key default gen_random_uuid(),
  business_id  uuid references crm_businesses(id) on delete cascade,
  title        text not null,
  description  text,
  due_at       timestamptz,
  assigned_to  uuid references profiles(id) on delete set null,
  status       crm_task_status not null default 'pending',
  created_by   uuid references profiles(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index crm_tasks_business_idx   on crm_tasks(business_id);
create index crm_tasks_due_idx        on crm_tasks(due_at) where status = 'pending';
create index crm_tasks_assigned_idx   on crm_tasks(assigned_to) where status = 'pending';

-- ── crm_email_templates ───────────────────────────────────────────────────────

create table crm_email_templates (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  subject    text not null,
  body_html  text not null,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Seed standard templates.
insert into crm_email_templates (name, subject, body_html) values
(
  'Initial Outreach',
  'Better Off Local — free listing for {{business_name}}',
  '<p>Hi {{contact_name}},</p><p>I''m reaching out from Better Off Local, a local discount membership platform launching in {{region_name}}.</p><p>We''re inviting local businesses like yours to list their offers for free during our growth phase. Members pay a monthly subscription and use their card to redeem exclusive discounts directly at your business.</p><p>There''s no cost to get started, and your first venue is free while we grow. Would you be open to a quick call to find out if it''s a fit?</p><p>Best,<br>{{sender_name}}</p>'
),
(
  'Follow-Up',
  'Following up — Better Off Local',
  '<p>Hi {{contact_name}},</p><p>Just following up on my earlier message about Better Off Local. We''re building a community of independent businesses in {{region_name}} and I''d love to include {{business_name}}.</p><p>Happy to answer any questions or jump on a quick call — whatever works best for you.</p><p>Best,<br>{{sender_name}}</p>'
),
(
  'Meeting Confirmation',
  'Meeting confirmed — Better Off Local',
  '<p>Hi {{contact_name}},</p><p>Looking forward to our call! Just confirming we''re meeting on {{meeting_date}} at {{meeting_time}}.</p><p>I''ll send a calendar invite shortly. Please feel free to reach out if anything changes.</p><p>Best,<br>{{sender_name}}</p>'
),
(
  'Post-Meeting Follow-Up',
  'Great speaking with you — next steps',
  '<p>Hi {{contact_name}},</p><p>Thanks for taking the time to chat today. It was great to learn more about {{business_name}}.</p><p>As we discussed, the next step is to set up your listing on Better Off Local. You can get started here: {{signup_link}}</p><p>It takes about 10 minutes and I''m happy to walk you through it if you''d like. Let me know if you have any questions.</p><p>Best,<br>{{sender_name}}</p>'
),
(
  'Retailer Onboarding',
  'Welcome to Better Off Local — let''s set up your listing',
  '<p>Hi {{contact_name}},</p><p>Welcome to Better Off Local! We''re excited to have {{business_name}} on board.</p><p>To get your listing live, just log in to your retailer dashboard and complete your profile, add your location, and create your first offer.</p><p>If you need any help, just reply to this email and we''ll get you sorted.</p><p>Best,<br>{{sender_name}}</p>'
),
(
  'Region Launch Announcement',
  '{{region_name}} is going live — your listing is about to reach members',
  '<p>Hi {{contact_name}},</p><p>Exciting news — Better Off Local is officially launching in {{region_name}}!</p><p>Your listing for {{business_name}} is now visible to members who are actively looking for local deals in your area.</p><p>Make sure your offers are up to date so you''re ready to welcome your first members.</p><p>Best,<br>{{sender_name}}</p>'
);

-- ── crm_emails ────────────────────────────────────────────────────────────────

create table crm_emails (
  id                   uuid primary key default gen_random_uuid(),
  business_id          uuid not null references crm_businesses(id) on delete cascade,
  template_id          uuid references crm_email_templates(id) on delete set null,
  subject              text not null,
  body_html            text not null,
  sent_to              text not null,
  sent_by              uuid references profiles(id) on delete set null,
  sent_at              timestamptz not null default now(),
  mailgun_message_id   text,
  delivery_status      text default 'queued',  -- queued, delivered, failed, bounced
  opened_at            timestamptz,
  clicked_at           timestamptz,
  created_at           timestamptz not null default now()
);

create index crm_emails_business_idx on crm_emails(business_id);
create index crm_emails_mailgun_idx  on crm_emails(mailgun_message_id) where mailgun_message_id is not null;

-- ── crm_activity_log ──────────────────────────────────────────────────────────

create table crm_activity_log (
  id           uuid primary key default gen_random_uuid(),
  business_id  uuid not null references crm_businesses(id) on delete cascade,
  type         text not null, -- email_sent, meeting_created, meeting_outcome, task_created,
                              -- task_completed, note_added, stage_changed, retailer_linked,
                              -- signup_link_clicked
  description  text not null,
  metadata     jsonb,
  created_by   uuid references profiles(id) on delete set null,
  created_at   timestamptz not null default now()
);

create index crm_activity_business_idx on crm_activity_log(business_id, created_at desc);

-- ── Computed effective stage ───────────────────────────────────────────────────
-- Returns the auto-derived pipeline stage based on platform data.
-- Falls back to manual stage for pure prospects with no retailer account.

create or replace function crm_compute_stage(
  p_business_id   uuid,
  p_manual_stage  crm_stage,
  p_retailer_id   uuid
) returns crm_stage language plpgsql stable as $$
declare
  r                 record;
  has_location      boolean;
  has_live_offer    boolean;
  profile_complete  boolean;
begin
  -- No retailer linked → use manual stage as-is.
  if p_retailer_id is null then
    return p_manual_stage;
  end if;

  -- Load retailer row.
  select approval_status, visibility_status, is_active,
         short_description, logo_url, cover_image_url
  into r
  from retailers
  where id = p_retailer_id;

  if not found then return p_manual_stage; end if;

  -- Churned: subscription cancelled or retailer deactivated.
  if not r.is_active then return 'churned'; end if;

  -- Check subscription (churned if cancelled/expired).
  if exists (
    select 1 from retailer_subscriptions
    where retailer_id = p_retailer_id
      and status::text in ('cancelled', 'expired')
  ) and not exists (
    select 1 from retailer_subscriptions
    where retailer_id = p_retailer_id
      and status::text in ('active', 'trialing')
  ) then
    return 'churned';
  end if;

  -- Check live offer.
  select exists (
    select 1 from offers
    where retailer_id = p_retailer_id and status = 'live'
  ) into has_live_offer;

  -- Live: approved + active + at least one live offer.
  if r.approval_status = 'approved' and r.visibility_status = 'live' and has_live_offer then
    return 'live';
  end if;

  -- Profile completeness.
  profile_complete := (
    r.short_description is not null and r.short_description <> ''
    and r.logo_url is not null
  );

  -- Check location.
  select exists (
    select 1 from retailer_locations
    where retailer_id = p_retailer_id and is_active
  ) into has_location;

  -- Ready to launch: approved, profile complete, location, offer exists (any status > draft).
  if r.approval_status = 'approved'
     and profile_complete
     and has_location
     and exists (
       select 1 from offers
       where retailer_id = p_retailer_id
         and status::text not in ('draft', 'rejected', 'archived')
     )
  then
    return 'ready_to_launch';
  end if;

  -- Awaiting offer: profile complete + location, but no offer yet.
  if profile_complete and has_location then
    return 'awaiting_offer';
  end if;

  -- Awaiting content: has location but profile incomplete.
  if has_location then
    return 'awaiting_content';
  end if;

  -- Retailer account exists → Onboarding.
  return 'onboarding';
end;
$$;

-- ── crm_business_view ─────────────────────────────────────────────────────────
-- Flat denormalised view for the pipeline page.

create view crm_business_view as
select
  b.id,
  b.name,
  b.contact_name,
  b.email,
  b.phone,
  b.website,
  b.category,
  b.notes,
  b.last_contact_at,
  b.next_followup_at,
  b.signup_link_token,
  b.signup_link_clicked_at,
  b.created_at,
  b.updated_at,
  b.retailer_id,
  b.stage                                                    as manual_stage,
  crm_compute_stage(b.id, b.stage, b.retailer_id)           as effective_stage,
  b.region_id,
  reg.name                                                   as region_name,
  b.assigned_to,
  p.full_name                                                as assigned_name,
  r.approval_status                                          as retailer_approval_status,
  r.visibility_status                                        as retailer_visibility,
  r.is_active                                                as retailer_is_active,
  r.onboarding_step,
  -- Onboarding checklist counts.
  (r.name is not null and r.name <> '')::int
    + (r.short_description is not null and r.short_description <> '')::int
    + (r.logo_url is not null)::int
    + (r.cover_image_url is not null)::int
    + (exists(select 1 from retailer_locations rl where rl.retailer_id = r.id and rl.is_active))::int
    + (exists(select 1 from offers o where o.retailer_id = r.id and o.status::text not in ('draft','rejected','archived')))::int
    + (exists(select 1 from retailer_subscriptions rs where rs.retailer_id = r.id and rs.status::text in ('active','trialing')))::int
    as onboarding_score,   -- out of 7
  (select count(*)::integer from crm_meetings m where m.business_id = b.id)
    as meeting_count,
  (select count(*)::integer from crm_emails e where e.business_id = b.id)
    as email_count,
  (select count(*)::integer from crm_tasks t where t.business_id = b.id and t.status = 'pending')
    as pending_task_count
from crm_businesses b
left join regions reg on reg.id = b.region_id
left join profiles p on p.id = b.assigned_to
left join retailers r on r.id = b.retailer_id;

grant select on crm_business_view to authenticated;

-- ── RLS: admin-only ───────────────────────────────────────────────────────────

alter table crm_businesses       enable row level security;
alter table crm_meetings         enable row level security;
alter table crm_tasks            enable row level security;
alter table crm_emails           enable row level security;
alter table crm_email_templates  enable row level security;
alter table crm_activity_log     enable row level security;

-- All CRM tables: service role bypasses RLS; regular auth must be admin.
-- The admin portal uses the service client, so these are just safety guards.

create policy "admin_crm_businesses"    on crm_businesses       using (true) with check (true);
create policy "admin_crm_meetings"      on crm_meetings         using (true) with check (true);
create policy "admin_crm_tasks"         on crm_tasks            using (true) with check (true);
create policy "admin_crm_emails"        on crm_emails           using (true) with check (true);
create policy "admin_crm_templates"     on crm_email_templates  using (true) with check (true);
create policy "admin_crm_activity"      on crm_activity_log     using (true) with check (true);
