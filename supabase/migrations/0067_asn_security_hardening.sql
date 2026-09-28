-- =====================================================================
-- ASN — Security hardening (from the DMN replication pack "fix first" list)
-- Run AFTER 0066_founding_invite_pricing.sql.
-- Paste into Supabase Dashboard → SQL Editor → New query → Run.
--
-- Every statement here is idempotent (if not exists / or replace /
-- drop if exists), so re-running the file is safe. Nothing in the
-- "Do not change (security-bearing)" list of 09-database.md is dropped;
-- the 0052 triggers are re-created with the SAME column lists, only the
-- role test changes (see (c) below).
--
-- Sections
--   (a) stripe_events gets RLS (no policies) — service-role only
--   (b) members: revoke UPDATE from authenticated + column-pinning trigger
--   (c) vendors/experts 0052 pinning triggers re-created WITHOUT
--       security definer so the role test actually sees the caller
--   (d) early_member_locked one-way guard (mirrors guard_founding_lock)
--   (e) resources SELECT policies consolidated + column-level anon grant
--   (f) avatars bucket created in a migration (public read, server writes)
--   (g) rate_limits table + check_rate_limit() RPC (service-role only)
--   (h) leftover permissive resources policy removed (part of (e))
-- =====================================================================


-- ---------------------------------------------------------------------
-- (0) Shared helper: "is this write coming from a client role?"
--
-- Why this exists: the 0052 triggers were declared `security definer`
-- and tested `current_user`. Inside a security definer function Postgres
-- reports current_user as the function OWNER (postgres), never `anon` or
-- `authenticated`, so the early `return new` fired for every caller and
-- the pinning never ran. This helper is NOT security definer, so
-- current_user is the role PostgREST switched into for the request. It
-- also checks session_user and the JWT role claim as belt and braces
-- (Supabase sets request.jwt.claim.role on older stacks and
-- request.jwt.claims (json) on newer ones).
--
-- Returns true for `anon` / `authenticated` (browser + anon key) and
-- false for `service_role` (API routes), `postgres` / `supabase_admin`
-- (SQL editor, migrations) and any other server role.
-- ---------------------------------------------------------------------
create or replace function public.is_client_role()
returns boolean
language plpgsql
stable
as $$
declare
  jwt_role text;
begin
  begin
    jwt_role := coalesce(
      nullif(current_setting('request.jwt.claim.role', true), ''),
      (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role')
    );
  exception when others then
    jwt_role := null;
  end;

  return current_user in ('anon', 'authenticated')
      or session_user in ('anon', 'authenticated')
      or coalesce(jwt_role, '') in ('anon', 'authenticated');
end;
$$;

comment on function public.is_client_role() is
  'True when the current statement runs as anon/authenticated (browser or anon key). NOT security definer on purpose.';


-- ---------------------------------------------------------------------
-- (a) stripe_events — the only application table without RLS. It holds
--     full webhook payloads. No grants were ever issued to anon /
--     authenticated, but "Automatically expose new tables" being OFF was
--     the only thing protecting it. RLS on + no policies = deny-all for
--     client roles; the service role (webhook) bypasses RLS.
-- ---------------------------------------------------------------------
alter table public.stripe_events enable row level security;
revoke all on public.stripe_events from anon, authenticated;
grant all on public.stripe_events to service_role;


-- ---------------------------------------------------------------------
-- (b) members — client-writable whole-row until now.
--
--     0004 granted `select, update` to authenticated and 0003's
--     members_update_self lets a signed-in member PATCH ANY column of
--     their own row through PostgREST (subscription_status = 'active',
--     tier, account_type, founding_member_locked, stripe_* …). The app
--     never writes members from the browser (every member edit goes
--     through /api/member/profile with the service role), so:
--       1. revoke UPDATE from authenticated (closes the path outright);
--       2. add a column-pinning trigger that is NOT security definer, so
--          if anyone ever re-grants UPDATE the privileged columns still
--          cannot move from a client role.
--     The 0003 policies are left in place (they are harmless without the
--     grant and still scope reads).
-- ---------------------------------------------------------------------
revoke update on public.members from authenticated;
revoke insert, delete on public.members from authenticated;
grant select on public.members to authenticated;

create or replace function public.protect_member_privileged_cols()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- Service role (API routes), migrations and SQL-editor sessions pass.
  if not public.is_client_role() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    -- No client insert path exists. Fail closed rather than let a future
    -- grant create pre-activated or pre-billed rows.
    raise exception
      'members: % may not insert member rows. Use the server API.',
      current_user
      using errcode = 'insufficient_privilege';
  end if;

  if new.status                 is distinct from old.status
  or new.tier                   is distinct from old.tier
  or new.account_type           is distinct from old.account_type
  or new.subscription_status    is distinct from old.subscription_status
  or new.subscription_interval  is distinct from old.subscription_interval
  or new.stripe_customer_id     is distinct from old.stripe_customer_id
  or new.stripe_subscription_id is distinct from old.stripe_subscription_id
  or new.stripe_price_id        is distinct from old.stripe_price_id
  or new.founding_member_locked is distinct from old.founding_member_locked
  or new.early_member_locked    is distinct from old.early_member_locked
  or new.referral_code_id       is distinct from old.referral_code_id
  or new.auth_user_id           is distinct from old.auth_user_id
  or new.email                  is distinct from old.email
  or new.activated_at           is distinct from old.activated_at
  or new.activated_by           is distinct from old.activated_by
  or new.welcome_sent_at        is distinct from old.welcome_sent_at
  or new.current_period_end     is distinct from old.current_period_end
  or new.cancel_at_period_end   is distinct from old.cancel_at_period_end
  or new.canceled_at            is distinct from old.canceled_at
  or new.card_brand             is distinct from old.card_brand
  or new.card_last4             is distinct from old.card_last4
  or new.agreement_version      is distinct from old.agreement_version
  or new.agreement_accepted_at  is distinct from old.agreement_accepted_at
  or new.signup_channel         is distinct from old.signup_channel
  then
    raise exception
      'members: % may not change billing, status, identity or lock columns. Use the server API.',
      current_user
      using errcode = 'insufficient_privilege';
  end if;

  return new;
end;
$$;

drop trigger if exists members_protect_privileged on public.members;
create trigger members_protect_privileged
  before insert or update on public.members
  for each row execute function public.protect_member_privileged_cols();


-- ---------------------------------------------------------------------
-- (c) vendors / experts — re-create the 0052 pinning triggers WITHOUT
--     security definer. Column lists are copied from 0052 verbatim; the
--     only change is the role test (is_client_role() instead of
--     current_user inside a security definer body). Behaviour for the
--     service role is unchanged (pass-through).
-- ---------------------------------------------------------------------
drop trigger if exists vendors_protect_privileged on public.vendors;
drop trigger if exists experts_protect_privileged on public.experts;

create or replace function public.protect_vendor_privileged_cols()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- Service role (API routes) + admin SQL sessions pass through.
  if not public.is_client_role() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    -- Self-service inserts can never arrive pre-approved or pre-billed.
    new.status := 'pending_review';
    new.verified := false;
    new.billing_parent_id := null;
    new.stripe_customer_id := null;
    new.stripe_subscription_id := null;
    new.subscription_status := null;
    new.months_in_program := 0;
    new.auth_user_id := coalesce(new.auth_user_id, null);
    return new;
  end if;

  -- UPDATE: privileged columns keep their old values.
  new.status := old.status;
  new.verified := old.verified;
  new.plan_id := old.plan_id;
  new.billing_parent_id := old.billing_parent_id;
  new.stripe_customer_id := old.stripe_customer_id;
  new.stripe_subscription_id := old.stripe_subscription_id;
  new.subscription_status := old.subscription_status;
  new.months_in_program := old.months_in_program;
  new.auth_user_id := old.auth_user_id;
  -- contact_email intentionally NOT pinned — the vendor profile page
  -- legitimately edits it client-side.
  new.agreement_signed_at := old.agreement_signed_at;
  new.agreement_version := old.agreement_version;
  new.agreement_ip_hash := old.agreement_ip_hash;
  new.agreement_user_agent := old.agreement_user_agent;
  return new;
end;
$$;

create trigger vendors_protect_privileged
  before insert or update on public.vendors
  for each row execute function public.protect_vendor_privileged_cols();

create or replace function public.protect_expert_privileged_cols()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if not public.is_client_role() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    -- experts has no client insert grant today; if one ever appears,
    -- fail closed on the privileged fields.
    new.status := 'invited';
    new.billing_exempt := false;
    new.stripe_customer_id := null;
    new.stripe_subscription_id := null;
    new.subscription_status := null;
    new.months_in_program := 0;
    return new;
  end if;

  new.status := old.status;
  new.billing_exempt := old.billing_exempt;
  new.stripe_customer_id := old.stripe_customer_id;
  new.stripe_subscription_id := old.stripe_subscription_id;
  new.subscription_status := old.subscription_status;
  new.months_in_program := old.months_in_program;
  new.auth_user_id := old.auth_user_id;
  new.email := old.email;
  new.agreement_signed_at := old.agreement_signed_at;
  new.agreement_version := old.agreement_version;
  new.agreement_ip_hash := old.agreement_ip_hash;
  new.agreement_user_agent := old.agreement_user_agent;
  return new;
end;
$$;

create trigger experts_protect_privileged
  before insert or update on public.experts
  for each row execute function public.protect_expert_privileged_cols();


-- ---------------------------------------------------------------------
-- (d) early_member_locked — one-way guard, same shape as
--     guard_founding_lock() (0015). ASN has no early tier
--     (EARLY_MEMBER_CAP = 0) so the flag should never be set, but if it
--     ever is, it must never be un-set.
-- ---------------------------------------------------------------------
create or replace function public.guard_early_member_lock()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.early_member_locked = true and new.early_member_locked = false then
    raise exception 'early_member_locked cannot be un-set (member %)', old.id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_early_lock_guard on public.members;
create trigger trg_early_lock_guard
  before update on public.members
  for each row execute function public.guard_early_member_lock();


-- ---------------------------------------------------------------------
-- (e) + (h) resources — one SELECT policy per role.
--
--     0013 dropped the wrong policy name, so 0011's
--     resources_select_active_members (is_published only, no
--     submission_status filter) survived next to 0013's
--     resources_active_member_read. Policies OR together, so an active
--     member could read pending/rejected rows that were still flagged
--     is_published. Also, anon had a TABLE-WIDE select grant, exposing
--     storage_path / external_url of approved rows.
--
--     After this block:
--       authenticated: approved + published, and (admin or ACTIVE member
--                      with account_type = 'member'; job seekers excluded)
--       anon:          approved + published, and only the columns in the
--                      grant below (no storage_path, no external_url,
--                      no book_club_payload, no review trail)
--     resources_write_admin (for all, is_admin) is untouched — it is what
--     lets the admin console see drafts.
-- ---------------------------------------------------------------------
drop policy if exists resources_active_member_read     on public.resources;
drop policy if exists resources_select_active_members  on public.resources;
drop policy if exists resources_public_landing_read    on public.resources;
drop policy if exists resources_select_authenticated   on public.resources;
drop policy if exists resources_select_anon_landing    on public.resources;

create policy resources_select_authenticated
  on public.resources
  for select
  to authenticated
  using (
    submission_status = 'approved'
    and is_published = true
    and (
      public.is_admin()
      or exists (
        select 1 from public.members m
        where m.auth_user_id = (select auth.uid())
          and m.status = 'active'
          and m.account_type = 'member'
      )
    )
  );

create policy resources_select_anon_landing
  on public.resources
  for select
  to anon
  using (submission_status = 'approved' and is_published = true);

revoke all on public.resources from anon;
grant select (
  id, topic_slug, topic_title, topic_summary, category,
  portal_card_url, resource_card_url, title, description, kind,
  thumbnail_url, mime_type, file_size_bytes, duration_label, position,
  is_free, is_published, submission_status, kit_type,
  originating_expert_id, originating_vendor_id, created_at, updated_at
) on public.resources to anon;

-- authenticated keeps whole-row select (members need external_url to
-- open a kit; RLS limits rows to approved + published).
grant select on public.resources to authenticated;


-- ---------------------------------------------------------------------
-- (f) avatars bucket — DMN created it from the dashboard; ASN creates it
--     here. Public read (the app builds public URLs into *.avatar_url).
--     Writes go ONLY through the service role in /api/member/profile,
--     /api/expert/profile/avatar and /api/vendor/profile/avatar, so there
--     is deliberately NO insert/update/delete policy for client roles.
--     The bucket-level 5 MB limit and image allow-list mirror the
--     routes' checks (5 MB, image/*) but exclude SVG (script-capable).
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars', 'avatars', true, 5242880,
  array['image/png', 'image/jpeg', 'image/webp', 'image/gif']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "avatars public read" on storage.objects;
create policy "avatars public read"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'avatars');
-- No insert / update / delete policies on purpose (service role only).


-- ---------------------------------------------------------------------
-- (g) Rate limiting that survives cold starts.
--
--     src/lib/waitlist/rateLimit.ts is an in-memory Map, so on Vercel
--     each instance has its own counter. This table + RPC is the
--     distributed replacement. Contract for the app (service role only):
--
--       select public.check_rate_limit('<purpose>:<ip>:<email>', 5, 600);
--         → true  = allowed (count within the window is <= limit)
--         → false = over the limit; respond 429 with
--                   Retry-After: <p_window_seconds>
--
--     Fixed window: the first hit opens a window of p_window_seconds;
--     hits inside it increment; the first hit after it expires resets
--     to 1. Rows older than one day are swept on every call (indexed,
--     so it is a no-op when there is nothing to delete).
--
--     RLS on, no policies, all client grants revoked: only the service
--     role can call the RPC or touch the table.
-- ---------------------------------------------------------------------
create table if not exists public.rate_limits (
  key          text primary key,
  count        integer not null default 0 check (count >= 0),
  window_start timestamptz not null default now()
);

create index if not exists rate_limits_window_start_idx
  on public.rate_limits (window_start);

alter table public.rate_limits enable row level security;
revoke all on public.rate_limits from anon, authenticated;
grant all on public.rate_limits to service_role;

comment on table public.rate_limits is
  'Fixed-window counters behind check_rate_limit(). Service-role only. Rows older than one day are swept by the RPC.';

create or replace function public.check_rate_limit(
  p_key text,
  p_limit integer,
  p_window_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now   timestamptz := clock_timestamp();
  v_count integer;
begin
  -- Defensive input checks: a bad call fails CLOSED (not allowed).
  if p_key is null or length(p_key) = 0 or length(p_key) > 512 then
    return false;
  end if;
  if p_limit is null or p_limit < 1 then
    return false;
  end if;
  if p_window_seconds is null or p_window_seconds < 1 then
    return false;
  end if;

  -- Small cleanup: forget windows older than a day.
  delete from public.rate_limits
   where window_start < v_now - interval '1 day';

  insert into public.rate_limits (key, count, window_start)
  values (p_key, 1, v_now)
  on conflict (key) do update
    set count = case
          when public.rate_limits.window_start < v_now - make_interval(secs => p_window_seconds)
            then 1
          else public.rate_limits.count + 1
        end,
        window_start = case
          when public.rate_limits.window_start < v_now - make_interval(secs => p_window_seconds)
            then v_now
          else public.rate_limits.window_start
        end
  returning count into v_count;

  return v_count <= p_limit;
end;
$$;

revoke all on function public.check_rate_limit(text, integer, integer) from public;
revoke all on function public.check_rate_limit(text, integer, integer) from anon, authenticated;
grant execute on function public.check_rate_limit(text, integer, integer) to service_role;

comment on function public.check_rate_limit(text, integer, integer) is
  'Fixed-window rate limiter. Returns true when the call is allowed, false when over p_limit within p_window_seconds. Service-role only.';


notify pgrst, 'reload schema';
