-- =====================================================================
-- ASN — Pearl inquiry pack delivery (Phase 2/3)
-- Run after 0048_member_inquiries.sql.
--
--   1. member_seen_at — drives the member Inbox unread badge.
--   2. inquiry-packs storage bucket (public) — holds the generated PDF
--      packs. Public read is fine: the pack only contains info members
--      already see in the portal (experts, published offers, resources).
-- =====================================================================

alter table public.member_inquiries
  add column if not exists member_seen_at timestamptz;

insert into storage.buckets (id, name, public)
values ('inquiry-packs', 'inquiry-packs', true)
on conflict (id) do nothing;

notify pgrst, 'reload schema';
