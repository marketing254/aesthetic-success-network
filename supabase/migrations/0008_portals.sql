-- ============================================================
-- ASN portal phase · 0008 — Expert Hotline, vendor deals, expert kits
--
-- Backs the three member-facing portals that 0007 already gated:
--   /dashboard (members) · /expert (experts) · /vendor (partners)
--
-- Access model matches the admin console: RLS is deny-all and every
-- read/write goes through a route handler that runs a requirePortal*()
-- guard first, then uses the service-role client. The 0007 self-read
-- policies stay as they are — they exist only so the middleware gate
-- can check its own row with the anon key + session.
-- ============================================================

-- ── The Expert Hotline ──────────────────────────────────────────────
-- A member asks a question; an admin routes it to an approved expert;
-- the expert returns a written action plan in 2–3 business days.
create table if not exists public.hotline_requests (
  id                 uuid primary key default gen_random_uuid(),
  member_id          uuid not null references public.members(id) on delete cascade,
  member_email       text not null,
  subject            text not null,
  category           text,          -- Marketing, Staffing, Compliance, Pricing, …
  details            text not null,
  urgency            text not null default 'standard'
                     check (urgency in ('standard','urgent')),
  status             text not null default 'submitted'
                     check (status in ('submitted','assigned','answered','closed')),
  assigned_expert_id uuid references public.expert_applications(id) on delete set null,
  assigned_at        timestamptz,
  assigned_by        text,          -- admin email who routed it
  answered_at        timestamptz,
  closed_at          timestamptz,
  created_at         timestamptz not null default now()
);

create index if not exists hotline_requests_member_idx
  on public.hotline_requests (member_id, created_at desc);
create index if not exists hotline_requests_expert_idx
  on public.hotline_requests (assigned_expert_id, created_at desc);
create index if not exists hotline_requests_status_idx
  on public.hotline_requests (status, created_at desc);

-- The written action plan. One per request in practice; the table allows
-- more so an expert can revise without destroying the original.
create table if not exists public.hotline_responses (
  id           uuid primary key default gen_random_uuid(),
  request_id   uuid not null references public.hotline_requests(id) on delete cascade,
  expert_id    uuid not null references public.expert_applications(id) on delete cascade,
  expert_email text not null,
  summary      text not null,          -- one-line answer
  action_plan  text not null,          -- the deliverable
  status       text not null default 'draft'
               check (status in ('draft','submitted')),
  submitted_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists hotline_responses_request_idx
  on public.hotline_responses (request_id, created_at desc);

-- One draft per expert per request — revisions update in place.
create unique index if not exists hotline_responses_request_expert_key
  on public.hotline_responses (request_id, expert_id);

-- ── Vendor deals ────────────────────────────────────────────────────
-- Approved partners publish member-only offers. Admin-reviewed before
-- they become visible to members.
create table if not exists public.vendor_deals (
  id             uuid primary key default gen_random_uuid(),
  partner_id     uuid not null references public.partner_applications(id) on delete cascade,
  company_name   text not null,       -- denormalised for member-facing reads
  title          text not null,
  category       text,
  description    text,
  deal_terms     text,                -- what the member actually gets
  redemption_url text,
  redemption_note text,               -- code / instructions if not a URL
  status         text not null default 'draft'
                 check (status in ('draft','pending_review','published','archived')),
  published_at   timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists vendor_deals_partner_idx
  on public.vendor_deals (partner_id, created_at desc);
create index if not exists vendor_deals_status_idx
  on public.vendor_deals (status, published_at desc);

-- ── Expert kits ─────────────────────────────────────────────────────
-- "New expert kits arrive weekly" — the recurring content promise.
create table if not exists public.expert_kits (
  id           uuid primary key default gen_random_uuid(),
  expert_id    uuid not null references public.expert_applications(id) on delete cascade,
  expert_name  text not null,         -- denormalised for member-facing reads
  title        text not null,
  category     text,
  summary      text,
  content      text,                  -- the kit body (markdown-ish plain text)
  resource_url text,                  -- optional download / external link
  status       text not null default 'draft'
               check (status in ('draft','published','archived')),
  published_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists expert_kits_expert_idx
  on public.expert_kits (expert_id, created_at desc);
create index if not exists expert_kits_status_idx
  on public.expert_kits (status, published_at desc);

-- ── RLS: deny-all (service role only, same as every intake table) ────
alter table public.hotline_requests  enable row level security;
alter table public.hotline_responses enable row level security;
alter table public.vendor_deals      enable row level security;
alter table public.expert_kits       enable row level security;
