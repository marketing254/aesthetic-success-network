-- =====================================================================
-- ASN — E-sign + one-link sign & pay
-- Run after 0033_vendor_expert_billing.sql.
--
-- Captures who agreed to which agreement version, when, from what IP,
-- and where the generated PDF lives. Every column is additive so
-- backfilling is a no-op — existing vendors/experts show up with
-- NULLs on these fields and the app treats them as "signed via legacy
-- flow" without breaking anything.
-- =====================================================================

-- ---------- vendors ----------
alter table public.vendors
  add column if not exists agreement_ip_hash    text,
  add column if not exists agreement_user_agent text,
  add column if not exists agreement_pdf_path   text;

-- ---------- experts ----------
-- experts didn't have any agreement columns before now — add the full
-- set here so the two audiences use the same schema.
alter table public.experts
  add column if not exists agreement_signed_at   timestamptz,
  add column if not exists agreement_version     text,
  add column if not exists agreement_ip_hash     text,
  add column if not exists agreement_user_agent  text,
  add column if not exists agreement_pdf_path    text;

-- ---------- storage bucket ----------
-- Bucket for signed agreement PDFs. Private (not public) — the confirmation
-- page + email attach signed URLs generated on-demand. If this migration
-- runs against a fresh project the bucket is created; on re-runs the
-- on-conflict-do-nothing keeps it idempotent.
insert into storage.buckets (id, name, public)
values ('agreements', 'agreements', false)
on conflict (id) do nothing;

-- Only the service role reads/writes this bucket. No RLS policies for
-- authenticated users — every access goes through a signed URL served
-- by our /api/join/*/agreement/download endpoint.
