-- =====================================================================
-- ASN — Verified-gate fix + auth link backfill
-- Run this after 0006_logo_storage.sql.
--
-- Three things land here:
--   1. current_vendor_id() returns the row for ANY active vendor, not
--      just approved ones. Pending vendors still need a working row id
--      so RLS-protected queries (read profile, fetch own catalog) don't
--      collapse to NULL.
--   2. Inserts on catalog_items, catalog_media, offers, offer_media
--      additionally check that the vendor is BOTH approved AND verified.
--      That enforces the "must be approved to publish" rule at the DB
--      level — defense in depth on top of the UI gate.
--   3. Backfill auth_user_id on any existing vendor rows where the email
--      matches a confirmed auth.users entry but the link wasn't set.
-- =====================================================================

-- 1. current_vendor_id — allow active statuses, not just approved
create or replace function public.current_vendor_id()
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select id
    from public.vendors
   where auth_user_id = auth.uid()
     and status in ('pending_review', 'approved')
   order by created_at asc
   limit 1;
$$;

-- 2. Tighten the write policies: vendor must be APPROVED + VERIFIED.
--    Admins (service_role + is_admin()) keep full access regardless.

create or replace function public.current_vendor_can_publish()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.vendors
    where auth_user_id = auth.uid()
      and status = 'approved'
      and verified = true
  );
$$;

revoke all on function public.current_vendor_can_publish from public;
grant execute on function public.current_vendor_can_publish to authenticated;

-- CATALOG ITEMS
drop policy if exists catalog_insert_own on public.catalog_items;
create policy catalog_insert_own
  on public.catalog_items
  for insert
  to authenticated
  with check (
    public.is_admin()
    or (
      vendor_id = public.current_vendor_id()
      and public.current_vendor_can_publish()
    )
  );

drop policy if exists catalog_update_own on public.catalog_items;
create policy catalog_update_own
  on public.catalog_items
  for update
  to authenticated
  using (
    public.is_admin()
    or (
      vendor_id = public.current_vendor_id()
      and public.current_vendor_can_publish()
    )
  );

-- OFFERS
drop policy if exists offers_insert_own on public.offers;
create policy offers_insert_own
  on public.offers
  for insert
  to authenticated
  with check (
    public.is_admin()
    or (
      vendor_id = public.current_vendor_id()
      and public.current_vendor_can_publish()
    )
  );

drop policy if exists offers_update_own on public.offers;
create policy offers_update_own
  on public.offers
  for update
  to authenticated
  using (
    public.is_admin()
    or (
      vendor_id = public.current_vendor_id()
      and public.current_vendor_can_publish()
    )
  );

-- 3. Backfill — link auth_user_id where email matches
update public.vendors v
set auth_user_id = u.id
from auth.users u
where v.auth_user_id is null
  and lower(v.contact_email::text) = lower(u.email);

-- Confirmation query (uncomment to inspect):
-- select id, contact_email, auth_user_id, status, verified
-- from public.vendors order by created_at desc;

notify pgrst, 'reload schema';
