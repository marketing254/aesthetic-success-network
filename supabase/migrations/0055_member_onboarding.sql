-- =====================================================================
-- ASN — Member onboarding + profile completeness
-- Run after 0054_member_promo_codes.sql.
--
-- Three chunks:
--  1. members.locations + members.biggest_challenge — the /join/member
--     form asks these but they were only forwarded in the team email,
--     never stored. Needed for the admin portal AND the personalized
--     kit-recommendation email.
--  2. member_onboarding_emails — approval-gated onboarding emails. A
--     draft is generated when a member's payment completes; the team
--     approves it from their inbox before anything reaches the member.
--  3. member_promo_codes.max_uses — each promo code covers a limited
--     number of seats (default 10). At the cap, checkout says the code
--     "has been fully claimed".
-- =====================================================================

-- 1 ── member profile fields --------------------------------------------
alter table public.members add column if not exists locations text;
alter table public.members add column if not exists biggest_challenge text;
comment on column public.members.locations is 'Number of practice locations — from the signup form.';
comment on column public.members.biggest_challenge is 'Biggest practice challenge — from the signup form.';

-- 2 ── onboarding email drafts ------------------------------------------
create table if not exists public.member_onboarding_emails (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members(id) on delete cascade,
  kind text not null default 'kit_recommendation',
  challenge text,
  kit_slug text,
  kit_title text,
  match_kind text,               -- 'best' | 'closest' | 'none'
  subject text not null,
  html text not null,
  status text not null default 'pending_approval',  -- pending_approval | approved_sent | no_match_slack | canceled
  approval_token text unique,
  approved_by text,
  sent_to_member_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists member_onboarding_emails_member_idx on public.member_onboarding_emails (member_id);

comment on table public.member_onboarding_emails is
  'Approval-gated member onboarding emails. Drafted on payment completion, previewed to the team, sent to the member only after one-click approval. Service-role only.';

-- 3 ── promo code seat cap ----------------------------------------------
alter table public.member_promo_codes add column if not exists max_uses integer not null default 10;
comment on column public.member_promo_codes.max_uses is 'Seats this code covers. At the cap the payment page says "fully claimed".';

-- Service-role only.
revoke all on public.member_onboarding_emails from anon, authenticated;
alter table public.member_onboarding_emails enable row level security;
