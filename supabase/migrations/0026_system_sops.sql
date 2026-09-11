-- ============================================================
-- ASN member portal · 0026 — Systems (SOPs & templates)
--
-- TD's "Systems" tab turned out to be a small, expert-approved library
-- of standard-operating-procedure documents members can run with their
-- team immediately — distinct from expert_kits (longer-form playbooks).
-- TD stores these as a hardcoded array pointing at real uploaded PDFs
-- in TD's own storage bucket, which ASN has no equivalent assets for,
-- so this ports as a real table (admin-manageable later) seeded with
-- original ASN content instead of copying TD's files.
-- ============================================================

create table if not exists public.system_sops (
  id           uuid primary key default gen_random_uuid(),
  slug         text not null unique,
  title        text not null,
  category     text,
  expert_id    uuid references public.expert_applications(id) on delete set null,
  expert_name  text,
  summary      text,
  content      text not null,
  status       text not null default 'published'
               check (status in ('draft','published','archived')),
  published_at timestamptz default now(),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists system_sops_status_idx
  on public.system_sops (status, published_at desc);

alter table public.system_sops enable row level security;

insert into public.system_sops (slug, title, category, summary, content, status, published_at)
values
(
  'no-show-recovery-script',
  'Recovering a client after a no-show',
  'Front Desk',
  'A same-day script for turning a missed appointment into a rebooked one instead of a lost client.',
  E'**When to use this**\nWithin 30 minutes of a missed appointment, before the client has decided the relationship is over.\n\n**Step 1 — Call, don''t text first**\nA phone call signals the client matters more than the slot. Open warm, not accusatory: "Hi [name], we had you down for 2pm today and wanted to check in — everything okay?"\n\n**Step 2 — Listen for the real reason**\nMost no-shows are logistics (forgot, conflict) not dissatisfaction. Let them explain before you offer anything.\n\n**Step 3 — Rebook on the call**\nDon''t hang up without a new time on the books. "I''ve got [day] at [time] or [day] at [time] — which works better?"\n\n**Step 4 — Note the pattern**\nLog the no-show in their chart. A second one in 90 days moves them to a deposit-required booking policy.\n\n**Step 5 — No-deposit clients still get one grace no-show**\nAfter that, require a card on file for future bookings — say so plainly, it protects the schedule for everyone.',
  'published',
  now()
),
(
  'consult-to-treatment-handoff',
  'Handing a consult off to the treatment room without losing momentum',
  'Patient Experience',
  'The exact handoff sequence that keeps a client''s "yes" from cooling between the consult room and the chair.',
  E'**The problem this solves**\nA client says yes in consult, then waits, then second-guesses the treatment by the time they''re in the chair.\n\n**Step 1 — Book the treatment before they leave the consult room**\nNever let a "yes" leave the building without a date on the calendar. If same-day isn''t possible, book it before they stand up.\n\n**Step 2 — The provider restates the plan in one sentence**\nWhen the treating provider walks in, the first thing they say is a one-sentence recap of what was agreed in consult — not a fresh explanation. This signals continuity, not a new pitch.\n\n**Step 3 — Confirm comfort, not consent, again**\nConsent was already given in consult. In the room, ask about comfort ("how are you feeling about today?") not "are you sure?" — the latter reopens the decision.\n\n**Step 4 — Set the next touchpoint before they leave**\nEvery treatment ends with a booked follow-up or a dated check-in message — never "we''ll see you whenever."',
  'published',
  now()
),
(
  'staff-huddle-template',
  'The 10-minute morning huddle template',
  'Team & Culture',
  'A repeatable daily huddle structure that surfaces schedule risks before they become client complaints.',
  E'**Run time**: 10 minutes, same time every day, standing up.\n\n**1. Today''s numbers (2 min)**\nBooked appointments, open slots, any same-day cancellations already known.\n\n**2. Flag the risk clients (3 min)**\nAnyone new, anyone with a past no-show, anyone on a treatment plan that''s about to lapse. Name them out loud.\n\n**3. One win from yesterday (2 min)**\nA client compliment, a smooth reschedule, a good save. Keeps the huddle from being only problems.\n\n**4. One blocker (2 min)**\nSupply running low, a room double-booked, a provider running behind. Whoever owns it says what they''ll do about it today.\n\n**5. Close on the plan, not the problem (1 min)**\nEnd every huddle with "here''s what we''re doing" — never end on an open question.',
  'published',
  now()
);
