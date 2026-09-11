-- ============================================================
-- ASN growth phase · 0020 — profile spotlights
--
-- Admin-managed "what's new" items attached to an expert or a partner
-- (news, events, features). Simplified from TD's version: no network
-- feed to post into (`expert_posts` is Phase 3 member-portal/social
-- infrastructure that doesn't exist in ASN yet), and no public
-- rendering surface wired up yet either — the Phase 1 expert/partner
-- detail pages are intentionally left untouched by this port. This
-- migration + its admin page give the team a place to draft and manage
-- spotlights now; showing them on public profiles is future work.
-- ============================================================

create table if not exists public.profile_spotlights (
  id                      uuid primary key default gen_random_uuid(),
  expert_application_id   uuid references public.expert_applications(id) on delete cascade,
  partner_application_id  uuid references public.partner_applications(id) on delete cascade,
  kind                    text not null default 'update'
                          check (kind in ('update','event','news','feature')),
  title                   text not null check (char_length(title) between 3 and 160),
  body                    text not null check (char_length(body) between 3 and 2000),
  link_url                text,
  link_label              text,
  image_url               text,
  event_date              date,
  is_published            boolean not null default false,
  created_by              uuid references public.admin_users(id) on delete set null,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  published_at            timestamptz,

  constraint profile_spotlights_one_owner check (
    (expert_application_id is not null and partner_application_id is null)
    or
    (expert_application_id is null and partner_application_id is not null)
  )
);

create index if not exists profile_spotlights_expert_idx
  on public.profile_spotlights (expert_application_id, is_published, published_at desc);
create index if not exists profile_spotlights_partner_idx
  on public.profile_spotlights (partner_application_id, is_published, published_at desc);

alter table public.profile_spotlights enable row level security;
