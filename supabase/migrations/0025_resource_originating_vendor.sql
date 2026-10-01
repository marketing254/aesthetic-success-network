-- =====================================================================
-- 0025_resource_originating_vendor.sql
--
-- Adds the partner (vendor) → resource link so member inquiries on a
-- partner-published resource can be routed to that partner's portal
-- inbox, mirroring the existing resources.originating_expert_id flow.
--
-- The vendor portal /vendor/inquiries page filters by
-- resources.originating_vendor_id = (current vendor's id).
--
-- Nullable: admin/expert-published resources stay null on this column.
-- =====================================================================

alter table public.resources
  add column if not exists originating_vendor_id uuid
    references public.vendors(id) on delete set null;

create index if not exists resources_originating_vendor_idx
  on public.resources (originating_vendor_id)
  where originating_vendor_id is not null;

notify pgrst, 'reload schema';
