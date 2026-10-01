-- =====================================================================
-- ASN — Catalog documents support (Phase 4)
-- Run this after 0007_verified_gate.sql.
--
-- Adds 'document' as a valid kind on catalog_media so vendors can attach
-- PDFs, spec sheets, brochures, etc. Plus creates a public storage
-- bucket for catalog media (images / videos / docs) with vendor-scoped
-- write policies.
-- =====================================================================

-- 1. Allow 'document' as a catalog_media kind.
alter table public.catalog_media
  drop constraint if exists catalog_media_kind_check;
alter table public.catalog_media
  add constraint catalog_media_kind_check
  check (kind in ('image', 'video', 'document'));

-- 2. Storage bucket for catalog media. Public so members can view docs
--    on the directory page. Path convention: {vendor_id}/{catalog_item_id}/...
insert into storage.buckets (id, name, public)
values ('catalog-media', 'catalog-media', true)
on conflict (id) do update set public = excluded.public;

-- Public read
drop policy if exists "catalog media public read" on storage.objects;
create policy "catalog media public read"
on storage.objects for select
to anon, authenticated
using (bucket_id = 'catalog-media');

-- Vendor can write to {their_vendor_id}/...
drop policy if exists "vendor can upload catalog media" on storage.objects;
create policy "vendor can upload catalog media"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'catalog-media'
  and (storage.foldername(name))[1] = public.current_vendor_id()::text
);

drop policy if exists "vendor can update catalog media" on storage.objects;
create policy "vendor can update catalog media"
on storage.objects for update
to authenticated
using (
  bucket_id = 'catalog-media'
  and (storage.foldername(name))[1] = public.current_vendor_id()::text
);

drop policy if exists "vendor can delete catalog media" on storage.objects;
create policy "vendor can delete catalog media"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'catalog-media'
  and (storage.foldername(name))[1] = public.current_vendor_id()::text
);

drop policy if exists "admin full access catalog media" on storage.objects;
create policy "admin full access catalog media"
on storage.objects for all
to authenticated
using (bucket_id = 'catalog-media' and public.is_admin())
with check (bucket_id = 'catalog-media' and public.is_admin());

notify pgrst, 'reload schema';
