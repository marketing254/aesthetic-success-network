-- =====================================================================
-- ASN — Standard (non-founding) personalized invite links
-- Run after 0050_spotlight_dual_owner.sql.
--
-- Admin creates a personalized link for an expert or partner prospect,
-- copies it, and pastes it into a MANUALLY written email. The link lands
-- on /invite/<code>, greets the person by name, and pre-fills the
-- standard application form (standard v1 agreement — NOT the bespoke
-- founding agreement, no Stripe at signup). Modeled on founding_invites
-- minus the agreement/PDF/payment columns.
-- =====================================================================

create table if not exists public.invite_links (
  id           uuid primary key default gen_random_uuid(),
  code         text not null unique,
  kind         text not null check (kind in ('expert', 'partner')),
  full_name    text not null check (length(full_name) between 2 and 120),
  email        text check (email is null or length(email) between 3 and 200),
  company_name text,                 -- partner company OR expert topic/firm
  notes        text,                 -- internal, admin-only
  status       text not null default 'active'
                 check (status in ('active', 'viewed', 'accepted', 'revoked')),
  viewed_at    timestamptz,
  accepted_at  timestamptz,
  -- Filled when the application row is created from this link.
  expert_id    uuid references public.experts(id),
  vendor_id    uuid references public.vendors(id),
  expires_at   timestamptz not null default (now() + interval '60 days'),
  created_by   uuid references public.admin_users(id),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists invite_links_status_idx
  on public.invite_links (status, created_at desc);

drop trigger if exists invite_links_updated_at on public.invite_links;
create trigger invite_links_updated_at
  before update on public.invite_links
  for each row execute function public.set_updated_at();

-- Service-role only — the unguessable code is the public credential.
alter table public.invite_links enable row level security;
grant all on public.invite_links to service_role;

notify pgrst, 'reload schema';
