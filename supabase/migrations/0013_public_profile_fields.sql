-- ============================================================
-- ASN content phase · 0013 — public profile fields for the
-- experts/partners directory (/experts/[id], /partners/[id])
--
-- The directory and detail pages read expert_applications /
-- partner_applications directly (they already ARE the experts/
-- partners table in this schema — see 0002/0003). Publish-ready gate:
-- status = 'approved' AND the write-up field (bio / description) is
-- filled in. headshot_url / logo_url are optional — a card without one
-- falls back to an initial badge, so admin approval alone is enough to
-- go live; no separate "make public" step or image pipeline required.
-- ============================================================

alter table public.expert_applications
  add column if not exists display_name text,   -- public display name override (defaults to full_name)
  add column if not exists headshot_url  text,
  add column if not exists website       text;

alter table public.partner_applications
  add column if not exists display_name text,    -- public display name override (defaults to company_name)
  add column if not exists logo_url      text;

-- Directory reads filter on these; keep the approved-with-writeup lookup fast.
create index if not exists expert_applications_public_idx
  on public.expert_applications (status) where status = 'approved';
create index if not exists partner_applications_public_idx
  on public.partner_applications (status) where status = 'approved';
