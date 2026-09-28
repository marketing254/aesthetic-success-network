-- =====================================================================
-- ASN — Member inquiries (Pearl escalations)
-- Run after 0047_profile_spotlights.sql.
--
-- When Pearl (the member AI expert) can't answer a question from portal
-- data, the member can hand it to the team. That creates one row here:
-- the question, the email to reach them at, and a status the team works
-- through within the 2–3 business-day SLA. Phase 2 fills pdf_url once the
-- "everything ASN offers" pack is generated + emailed.
-- =====================================================================

create table if not exists public.member_inquiries (
  id           uuid primary key default gen_random_uuid(),
  member_id    uuid not null references public.members(id) on delete cascade,
  email        text not null check (length(email) between 3 and 200),
  question     text not null check (length(question) between 1 and 4000),
  status       text not null default 'pending'
                 check (status in ('pending', 'emailed', 'in_progress', 'resolved', 'closed')),
  source       text not null default 'pearl',
  pdf_url      text,                -- link to the generated ASN pack (phase 2)
  pdf_sent_at  timestamptz,         -- when the pack email went out
  slack_ts     text,                -- Slack message ts, for threading a resolution (phase 3)
  admin_note   text,
  resolved_by  uuid references public.admin_users(id),
  resolved_at  timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists member_inquiries_status_idx
  on public.member_inquiries (status, created_at desc);
create index if not exists member_inquiries_member_idx
  on public.member_inquiries (member_id, created_at desc);

drop trigger if exists member_inquiries_updated_at on public.member_inquiries;
create trigger member_inquiries_updated_at
  before update on public.member_inquiries
  for each row execute function public.set_updated_at();

-- Reads/writes go through service-role guarded routes (member POST, admin
-- triage), same as offers/spotlights — no anon/authenticated policy.
alter table public.member_inquiries enable row level security;
grant all on public.member_inquiries to service_role;

notify pgrst, 'reload schema';
