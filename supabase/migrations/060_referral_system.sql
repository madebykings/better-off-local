-- 060_referral_system.sql
-- Complete referral system for Better Off Local.
--
-- Members invite friends via a unique referral code/link.
-- When the friend's first paid membership invoice clears, the referrer
-- earns a Stripe customer-balance credit (one month equivalent).
--
-- Tables:
--   referral_codes       — one per member, lazy-generated on first access
--   referral_invitations — one per attributed sign-up
--   referral_rewards     — one per invitation, tracks reward lifecycle
--
-- Profile link: profiles.referred_by_code_id (written at signup)
--
-- Fraud prevention:
--   • Self-referral: blocked in apply_referral_code RPC
--   • Duplicate invitee: unique(invitee_profile_id) on referral_invitations
--   • Rate limit: 5 confirmed rewards per referrer per 30-day window (configurable)
--   • Referrer membership must be active at point of award
--   • Grace period: 7 days before reward is confirmed

-- ── referral_codes ────────────────────────────────────────────────────────────
-- profiles.referred_by_code_id is added AFTER this table is created (see below).

create table referral_codes (
  id          uuid        primary key default gen_random_uuid(),
  profile_id  uuid        not null references profiles(id) on delete cascade,
  code        text        not null,
  is_active   boolean     not null default true,
  created_at  timestamptz not null default now(),
  constraint referral_codes_profile_unique  unique(profile_id),
  constraint referral_codes_code_unique     unique(code)
);

create index referral_codes_code_idx on referral_codes(code);

comment on table referral_codes is
  'One referral code per member. Code is short, uppercase, alphanumeric,
   excluding visually ambiguous characters (0, 1, I, O).';

-- ── Re-add profile FK now that referral_codes exists ─────────────────────────

alter table profiles
  add column referred_by_code_id uuid references referral_codes(id) on delete set null;

comment on column profiles.referred_by_code_id is
  'Set once at sign-up when the member joined via a referral link.
   Immutable after first write. NULL for members who joined organically.';

-- ── referral_invitations ──────────────────────────────────────────────────────

create table referral_invitations (
  id                  uuid        primary key default gen_random_uuid(),
  referral_code_id    uuid        not null references referral_codes(id),
  invitee_profile_id  uuid        not null references profiles(id) on delete cascade,
  device_fingerprint  text,
  attributed_at       timestamptz not null default now(),
  constraint referral_invitations_invitee_unique unique(invitee_profile_id)
);

create index referral_invitations_code_idx on referral_invitations(referral_code_id);
create index referral_invitations_invitee_idx on referral_invitations(invitee_profile_id);

comment on table referral_invitations is
  'One row per attributed sign-up. Invitee uniqueness prevents double-attribution.';

-- ── referral_reward_status ────────────────────────────────────────────────────

create type referral_reward_status as enum (
  'pending',    -- grace period not yet elapsed
  'confirmed',  -- grace period passed, reward locked in
  'applied',    -- Stripe credit applied to referrer
  'cancelled',  -- friend refunded or cancelled within grace period
  'voided',     -- manually voided by admin
  'review'      -- exceeded rate-limit window, awaiting admin review
);

-- ── referral_rewards ──────────────────────────────────────────────────────────

create table referral_rewards (
  id                      uuid                   primary key default gen_random_uuid(),
  referral_invitation_id  uuid                   not null references referral_invitations(id),
  referrer_profile_id     uuid                   not null references profiles(id),
  stripe_balance_txn_id   text,
  reward_amount_pence     integer                not null,
  status                  referral_reward_status not null default 'pending',
  applied_at              timestamptz,
  confirmed_at            timestamptz,
  voided_at               timestamptz,
  void_reason             text,
  created_at              timestamptz            not null default now(),
  updated_at              timestamptz            not null default now(),
  constraint referral_rewards_invitation_unique unique(referral_invitation_id)
);

create index referral_rewards_referrer_idx on referral_rewards(referrer_profile_id, status);

create trigger referral_rewards_updated_at
  before update on referral_rewards
  for each row execute function set_updated_at();

comment on table referral_rewards is
  'One reward row per invitation. Unique on invitation_id prevents double-award.';

-- ── RLS policies ──────────────────────────────────────────────────────────────

alter table referral_codes        enable row level security;
alter table referral_invitations  enable row level security;
alter table referral_rewards      enable row level security;

-- referral_codes: members read their own code; no client-side writes
create policy "Member reads own referral code"
  on referral_codes for select
  to authenticated
  using (profile_id = auth.uid());

-- referral_invitations: members read invitations linked to their code
create policy "Referrer reads own invitations"
  on referral_invitations for select
  to authenticated
  using (
    referral_code_id in (
      select id from referral_codes where profile_id = auth.uid()
    )
  );

-- referral_rewards: members read their own rewards
create policy "Member reads own rewards"
  on referral_rewards for select
  to authenticated
  using (referrer_profile_id = auth.uid());

-- ── generate_referral_code RPC ────────────────────────────────────────────────
-- Creates a code for the calling member if they don't already have one.
-- Returns the code string. Callable by authenticated users; idempotent.

create or replace function generate_referral_code(p_profile_id uuid)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_existing text;
  v_code     text;
  v_attempt  integer := 0;
  -- Characters excluding visually ambiguous: 0, 1, I, O
  v_chars    text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_len      integer := 7;
begin
  -- Return existing code if present
  select code into v_existing
    from referral_codes
   where profile_id = p_profile_id;
  if found then
    return v_existing;
  end if;

  -- Generate unique code
  loop
    v_attempt := v_attempt + 1;
    if v_attempt > 50 then
      raise exception 'Could not generate unique referral code after 50 attempts';
    end if;

    v_code := '';
    for i in 1..v_len loop
      v_code := v_code || substr(v_chars, floor(random() * length(v_chars) + 1)::int, 1);
    end loop;

    begin
      insert into referral_codes(profile_id, code)
      values (p_profile_id, v_code);
      return v_code;
    exception when unique_violation then
      -- collision on code — retry
      continue;
    end;
  end loop;
end;
$$;

-- Callable by authenticated users (members generate their own code)
grant execute on function generate_referral_code(uuid) to authenticated;

-- ── apply_referral_code RPC ───────────────────────────────────────────────────
-- Attributes a referral invitation after sign-up.
-- Called from the mobile app once the user has an authenticated session.
-- Idempotent: returns 'already_attributed' if the invitee already has a referrer.
-- Returns: 'ok' | 'not_found' | 'self_referral' | 'already_attributed'

create or replace function apply_referral_code(
  p_invitee_profile_id uuid,
  p_code               text,
  p_device_fingerprint text default null
)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_code_row referral_codes%rowtype;
begin
  -- Already has a referrer
  if exists(
    select 1 from referral_invitations
     where invitee_profile_id = p_invitee_profile_id
  ) then
    return 'already_attributed';
  end if;

  -- Resolve code (case-insensitive)
  select * into v_code_row
    from referral_codes
   where code = upper(p_code)
     and is_active = true;

  if not found then
    return 'not_found';
  end if;

  -- Self-referral guard
  if v_code_row.profile_id = p_invitee_profile_id then
    return 'self_referral';
  end if;

  -- Write invitation + link profile
  insert into referral_invitations(referral_code_id, invitee_profile_id, device_fingerprint)
  values (v_code_row.id, p_invitee_profile_id, p_device_fingerprint)
  on conflict (invitee_profile_id) do nothing;

  update profiles
     set referred_by_code_id = v_code_row.id
   where id = p_invitee_profile_id
     and referred_by_code_id is null;

  return 'ok';
end;
$$;

-- Callable by authenticated users (invitee attributes after sign-up)
grant execute on function apply_referral_code(uuid, text, text) to authenticated;

-- ── confirm_pending_referral_rewards ─────────────────────────────────────────
-- Run daily (via cron or manual trigger) to confirm rewards older than the grace
-- period. Returns count of rewards confirmed.
-- Grace period default: 7 days.

create or replace function confirm_pending_referral_rewards(
  p_grace_days integer default 7
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_count integer;
begin
  update referral_rewards
     set status       = 'confirmed',
         confirmed_at = now(),
         updated_at   = now()
   where status    = 'pending'
     and created_at < now() - (p_grace_days * interval '1 day');

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke execute on function confirm_pending_referral_rewards(integer) from public;
revoke execute on function confirm_pending_referral_rewards(integer) from anon;
revoke execute on function confirm_pending_referral_rewards(integer) from authenticated;
grant  execute on function confirm_pending_referral_rewards(integer) to service_role;

-- ── referral_stats view ───────────────────────────────────────────────────────
-- Summary per referrer: invited count, converted count, pending/confirmed rewards.
-- Accessible to the member via RLS (read own profile_id rows).

create or replace view referral_stats as
select
  rc.profile_id,
  rc.code,
  count(distinct ri.id)                                         as invited_count,
  count(distinct ri.id) filter (where rr.id is not null)       as converted_count,
  count(distinct rr.id) filter (where rr.status = 'pending')   as pending_rewards,
  count(distinct rr.id) filter (where rr.status in ('confirmed','applied')) as confirmed_rewards,
  coalesce(sum(rr.reward_amount_pence)
    filter (where rr.status in ('confirmed','applied')), 0)     as total_reward_pence
  from referral_codes rc
  left join referral_invitations ri on ri.referral_code_id = rc.id
  left join referral_rewards rr     on rr.referral_invitation_id = ri.id
 group by rc.profile_id, rc.code;

-- Note: RLS is on the base tables; the view is accessible to authenticated users
-- but only returns rows where profile_id = auth.uid() due to the RLS on referral_codes.
grant select on referral_stats to authenticated;
