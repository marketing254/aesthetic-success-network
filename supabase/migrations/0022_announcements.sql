-- ============================================================
-- ASN growth phase · 0022 — announcements (broadcast tool)
--
-- TD's Broadcast page sends through a Slack integration
-- (src/lib/slack.ts) and a member in-app notifications system
-- (api/notifications) — neither exists in ASN, and both are Phase 3
-- scope. Rather than pull that infrastructure in early, this table
-- just records the announcement itself: what an admin drafted, who
-- it's meant for, and whether it's been marked sent. No email/Slack
-- dispatch happens from this phase's admin page — "send" here only
-- flips a status + timestamp so the team can track intent to publish.
-- ============================================================

create table if not exists public.announcements (
  id          uuid primary key default gen_random_uuid(),
  title       text not null check (char_length(title) between 2 and 160),
  body        text not null check (char_length(body) between 1 and 4000),
  audience    text not null default 'all'
              check (audience in ('all','members','experts','partners')),
  status      text not null default 'draft'
              check (status in ('draft','sent')),
  sent_at     timestamptz,
  created_by  uuid references public.admin_users(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists announcements_status_idx
  on public.announcements (status, created_at desc);

alter table public.announcements enable row level security;
