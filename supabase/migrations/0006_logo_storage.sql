-- =====================================================================
-- ASN — Vendor logo storage (Phase 4)
-- Run this after 0005_admin_seed.sql.
--
-- Creates a public storage bucket `vendor-logos`, with policies that let
-- each vendor upload/replace/delete files keyed by their own vendor_id.
-- Files are publicly readable (logos are shown in the member directory
-- and inside the vendor's own portal).
-- =====================================================================

-- Create the bucket if it doesn't exist. Public = true means anonymous
-- HTTPS GETs are allowed (good — logos are public branding assets).
insert into storage.buckets (id, name, public)
values ('vendor-logos', 'vendor-logos', true)
on conflict (id) do update set public = excluded.public;

-- Path convention used by the upload code: `{vendor_id}/logo.{ext}`
-- The RLS policies key off the first folder segment of the object name.

-- Anyone can read (logos shown to anon visitors).
drop policy if exists "vendor logos public read" on storage.objects;
create policy "vendor logos public read"
on storage.objects for select
to anon, authenticated
using (bucket_id = 'vendor-logos');

-- A signed-in user can write to /vendor-logos/{their_vendor_id}/...
drop policy if exists "vendor can upload own logo" on storage.objects;
create policy "vendor can upload own logo"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'vendor-logos'
  and (storage.foldername(name))[1] = public.current_vendor_id()::text
);

drop policy if exists "vendor can update own logo" on storage.objects;
create policy "vendor can update own logo"
on storage.objects for update
to authenticated
using (
  bucket_id = 'vendor-logos'
  and (storage.foldername(name))[1] = public.current_vendor_id()::text
);

drop policy if exists "vendor can delete own logo" on storage.objects;
create policy "vendor can delete own logo"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'vendor-logos'
  and (storage.foldername(name))[1] = public.current_vendor_id()::text
);

-- Admins can do anything (service-role bypasses anyway, but a UI tool
-- using the user's session would benefit from this).
drop policy if exists "admin full access vendor logos" on storage.objects;
create policy "admin full access vendor logos"
on storage.objects for all
to authenticated
using (bucket_id = 'vendor-logos' and public.is_admin())
with check (bucket_id = 'vendor-logos' and public.is_admin());

notify pgrst, 'reload schema';
