-- =====================================================================
-- ASN — Notifications: reconcile the table with what the code writes
-- Run AFTER 0067_asn_security_hardening.sql.
-- Paste into Supabase Dashboard → SQL Editor → New query → Run.
--
-- 0010 created `notifications` for two audiences (vendor, admin). The
-- application code has since grown two more:
--
--   src/app/api/resources/[id]/inquiries/route.ts
--     audience 'expert' + recipient_auth_user_id   (new inquiry → expert)
--     audience 'vendor' + vendor_id + recipient_auth_user_id
--     audience 'admin'  + admin_id null
--   src/app/api/resources/[id]/inquiries/[inquiryId]/replies/route.ts
--     audience 'member' + recipient_auth_user_id   (reply → member inbox)
--     audience 'expert' + recipient_auth_user_id
--     audience 'vendor' + vendor_id + recipient_auth_user_id
--   src/app/api/admin/*, src/app/api/vendor/signup/route.ts
--     audience 'admin' / 'vendor' exactly as 0010
--   src/app/api/notifications/route.ts (GET/PATCH under RLS)
--     reads audience 'vendor' | 'admin' today; RLS below is ready for
--     'expert' and 'member' as soon as the route accepts them.
--
-- Against the 0010 shape those expert/member inserts fail the audience
-- CHECK and are dropped silently (the routes discard the insert result).
-- This file:
--   1. adds recipient_auth_user_id (what the code writes) plus expert_id
--      and member_id (FKs, per ASN-SWAP-CANON §7.6) and keeps them in
--      step with a small BEFORE INSERT trigger;
--   2. widens the audience CHECK to vendor | admin | expert | member and
--      re-states the per-audience row invariants;
--   3. adds indexes for the two new audiences;
--   4. adds RLS so each audience reads / marks-read only its own rows;
--   5. re-states grants (select + update(read_at) to authenticated; all
--      to service_role).
-- Idempotent throughout.
-- =====================================================================


-- ---- 1. Columns -----------------------------------------------------
alter table public.notifications
  add column if not exists recipient_auth_user_id uuid;

alter table public.notifications
  add column if not exists expert_id uuid references public.experts(id) on delete cascade;

alter table public.notifications
  add column if not exists member_id uuid references public.members(id) on delete cascade;

comment on column public.notifications.recipient_auth_user_id is
  'auth.users id of the person the row is for (expert / member / vendor audiences). Written by the API routes; RLS matches it to auth.uid().';
comment on column public.notifications.expert_id is
  'experts.id for audience = expert. Filled from recipient_auth_user_id by notifications_resolve_recipient() when the route omits it.';
comment on column public.notifications.member_id is
  'members.id for audience = member. Filled from recipient_auth_user_id by notifications_resolve_recipient() when the route omits it.';


-- ---- 2. Keep expert_id / member_id and recipient_auth_user_id in step --
-- The routes send recipient_auth_user_id only. This trigger fills the
-- matching FK (and the reverse, when a future caller sends the FK only)
-- BEFORE the CHECK constraints run, so either style of insert passes.
create or replace function public.notifications_resolve_recipient()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.audience = 'expert' then
    if new.expert_id is null and new.recipient_auth_user_id is not null then
      select e.id into new.expert_id
        from public.experts e
       where e.auth_user_id = new.recipient_auth_user_id
       limit 1;
    elsif new.expert_id is not null and new.recipient_auth_user_id is null then
      select e.auth_user_id into new.recipient_auth_user_id
        from public.experts e
       where e.id = new.expert_id;
    end if;
  elsif new.audience = 'member' then
    if new.member_id is null and new.recipient_auth_user_id is not null then
      select m.id into new.member_id
        from public.members m
       where m.auth_user_id = new.recipient_auth_user_id
       limit 1;
    elsif new.member_id is not null and new.recipient_auth_user_id is null then
      select m.auth_user_id into new.recipient_auth_user_id
        from public.members m
       where m.id = new.member_id;
    end if;
  elsif new.audience = 'vendor' then
    if new.vendor_id is not null and new.recipient_auth_user_id is null then
      select v.auth_user_id into new.recipient_auth_user_id
        from public.vendors v
       where v.id = new.vendor_id;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_notifications_resolve_recipient on public.notifications;
create trigger trg_notifications_resolve_recipient
  before insert on public.notifications
  for each row execute function public.notifications_resolve_recipient();


-- ---- 3. Constraints -------------------------------------------------
-- 0010 declared the audience CHECK inline, so Postgres auto-named it
-- notifications_audience_check. Drop both possible names, then re-add.
alter table public.notifications drop constraint if exists notifications_audience_check;
alter table public.notifications drop constraint if exists notif_audience_check;
alter table public.notifications
  add constraint notifications_audience_check
  check (audience in ('vendor', 'admin', 'expert', 'member'));

alter table public.notifications drop constraint if exists notif_vendor_row_check;
alter table public.notifications
  add constraint notif_vendor_row_check check (
    (audience = 'vendor'
      and vendor_id is not null
      and admin_id is null and expert_id is null and member_id is null)
    or
    (audience = 'admin'
      and vendor_id is null and expert_id is null and member_id is null)
    or
    (audience = 'expert'
      and (expert_id is not null or recipient_auth_user_id is not null)
      and vendor_id is null and admin_id is null and member_id is null)
    or
    (audience = 'member'
      and (member_id is not null or recipient_auth_user_id is not null)
      and vendor_id is null and admin_id is null and expert_id is null)
  );


-- ---- 4. Indexes -----------------------------------------------------
create index if not exists notifications_expert_idx
  on public.notifications (expert_id, created_at desc)
  where audience = 'expert';

create index if not exists notifications_member_idx
  on public.notifications (member_id, created_at desc)
  where audience = 'member';

create index if not exists notifications_recipient_idx
  on public.notifications (recipient_auth_user_id, created_at desc)
  where recipient_auth_user_id is not null;

create index if not exists notifications_unread_idx
  on public.notifications (audience, created_at desc)
  where read_at is null;


-- ---- 5. RLS ---------------------------------------------------------
alter table public.notifications enable row level security;

-- Vendor and admin policies from 0010 are re-stated unchanged so this
-- file stands on its own if 0010's policies were ever edited.
drop policy if exists notifications_select_vendor on public.notifications;
create policy notifications_select_vendor
  on public.notifications for select
  to authenticated
  using (audience = 'vendor' and vendor_id = public.current_vendor_id());

drop policy if exists notifications_update_vendor on public.notifications;
create policy notifications_update_vendor
  on public.notifications for update
  to authenticated
  using (audience = 'vendor' and vendor_id = public.current_vendor_id())
  with check (audience = 'vendor' and vendor_id = public.current_vendor_id());

drop policy if exists notifications_select_admin on public.notifications;
create policy notifications_select_admin
  on public.notifications for select
  to authenticated
  using (audience = 'admin' and public.is_admin());

drop policy if exists notifications_update_admin on public.notifications;
create policy notifications_update_admin
  on public.notifications for update
  to authenticated
  using (audience = 'admin' and public.is_admin())
  with check (audience = 'admin' and public.is_admin());

-- Expert: own rows, matched by experts.auth_user_id (via expert_id) or by
-- the direct recipient id the route wrote.
drop policy if exists notifications_select_expert on public.notifications;
create policy notifications_select_expert
  on public.notifications for select
  to authenticated
  using (
    audience = 'expert'
    and (
      recipient_auth_user_id = (select auth.uid())
      or expert_id in (select e.id from public.experts e where e.auth_user_id = (select auth.uid()))
    )
  );

drop policy if exists notifications_update_expert on public.notifications;
create policy notifications_update_expert
  on public.notifications for update
  to authenticated
  using (
    audience = 'expert'
    and (
      recipient_auth_user_id = (select auth.uid())
      or expert_id in (select e.id from public.experts e where e.auth_user_id = (select auth.uid()))
    )
  )
  with check (
    audience = 'expert'
    and (
      recipient_auth_user_id = (select auth.uid())
      or expert_id in (select e.id from public.experts e where e.auth_user_id = (select auth.uid()))
    )
  );

-- Member: own rows, matched by current_member_id() (active members only)
-- or by the direct recipient id.
drop policy if exists notifications_select_member on public.notifications;
create policy notifications_select_member
  on public.notifications for select
  to authenticated
  using (
    audience = 'member'
    and (
      recipient_auth_user_id = (select auth.uid())
      or member_id = public.current_member_id()
    )
  );

drop policy if exists notifications_update_member on public.notifications;
create policy notifications_update_member
  on public.notifications for update
  to authenticated
  using (
    audience = 'member'
    and (
      recipient_auth_user_id = (select auth.uid())
      or member_id = public.current_member_id()
    )
  )
  with check (
    audience = 'member'
    and (
      recipient_auth_user_id = (select auth.uid())
      or member_id = public.current_member_id()
    )
  );


-- ---- 6. Grants ------------------------------------------------------
-- Inserts are service-role only (the routes). Clients may read their rows
-- and mark them read; the only column a client may change is read_at.
grant all on public.notifications to service_role;
revoke insert, update, delete on public.notifications from authenticated;
grant select on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;
revoke all on public.notifications from anon;


notify pgrst, 'reload schema';
