-- =====================================================================
-- ASN — In-app notifications (Phase 5)
-- Run this after 0009_admin_rushdha_gmail.sql.
--
-- A single `notifications` table powers the bell-icon dropdown in both
-- the vendor portal and the admin console. Rows are scoped by audience:
--   audience = 'vendor' → vendor_id is set, admin_id is null
--   audience = 'admin'  → admin_id is set, vendor_id is null
--
-- We can also broadcast to ALL admins (admin_id = null + audience='admin')
-- for things like "new vendor applied" that anyone in the admin team
-- should see.
-- =====================================================================

create table if not exists public.notifications (
  id            uuid primary key default gen_random_uuid(),
  audience      text not null check (audience in ('vendor', 'admin')),
  vendor_id     uuid references public.vendors(id) on delete cascade,
  admin_id      uuid references public.admin_users(id) on delete cascade,
  kind          text not null,           -- e.g. 'vendor_approved', 'new_vendor_application', 'offer_submitted'
  title         text not null,
  body          text,
  link          text,                    -- relative URL the bell item links to
  metadata      jsonb not null default '{}'::jsonb,
  read_at       timestamptz,
  created_at    timestamptz not null default now(),
  -- Audience invariants
  constraint notif_vendor_row_check check (
    (audience = 'vendor' and vendor_id is not null and admin_id is null)
    or
    (audience = 'admin'  and vendor_id is null)
  )
);

create index if not exists notifications_vendor_idx
  on public.notifications (vendor_id, created_at desc)
  where audience = 'vendor';

create index if not exists notifications_admin_idx
  on public.notifications (admin_id, created_at desc)
  where audience = 'admin';

-- Explicit GRANTs (auto-expose is disabled on this project)
grant all on public.notifications to service_role;
grant select, update on public.notifications to authenticated;

alter table public.notifications enable row level security;

-- Vendor can read & mark-read their own notifications
drop policy if exists notifications_select_vendor on public.notifications;
create policy notifications_select_vendor
  on public.notifications for select
  to authenticated
  using (
    audience = 'vendor'
    and vendor_id = public.current_vendor_id()
  );

drop policy if exists notifications_update_vendor on public.notifications;
create policy notifications_update_vendor
  on public.notifications for update
  to authenticated
  using (
    audience = 'vendor'
    and vendor_id = public.current_vendor_id()
  );

-- Admins can read & update any admin-audience notification
drop policy if exists notifications_select_admin on public.notifications;
create policy notifications_select_admin
  on public.notifications for select
  to authenticated
  using (audience = 'admin' and public.is_admin());

drop policy if exists notifications_update_admin on public.notifications;
create policy notifications_update_admin
  on public.notifications for update
  to authenticated
  using (audience = 'admin' and public.is_admin());

-- Admin-only inserts via service_role from API routes; no direct insert
-- policy needed for end-users.

notify pgrst, 'reload schema';
