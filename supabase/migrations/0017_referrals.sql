-- ============================================================
-- ASN growth phase · 0017 — referral codes + signups
--
-- Every approved expert or partner can get one referral code so the
-- admin team can track who's sending members. `referral_signups`
-- records attribution when a member's `referral_code_id` is stamped
-- (that stamping happens in a future member-signup phase — this
-- migration only adds the column + table so the admin console has
-- somewhere to read from and write to today).
--
-- Kept deliberately simpler than a full revenue-attribution system:
-- no Stripe webhook wiring in this phase (billing code is untouched
-- per the port's scope) — just codes, signups, and a converted flag
-- an admin can set by hand until that webhook exists.
-- ============================================================

create table if not exists public.referral_codes (
  id                      uuid primary key default gen_random_uuid(),
  expert_application_id   uuid references public.expert_applications(id) on delete cascade,
  partner_application_id  uuid references public.partner_applications(id) on delete cascade,
  code                    text not null check (char_length(code) between 4 and 16),
  slug                    text,                 -- optional vanity handle, e.g. /join?ref=drchen
  active                  boolean not null default true,
  created_by              uuid references public.admin_users(id) on delete set null,
  created_at              timestamptz not null default now(),

  constraint referral_codes_one_owner check (
    (expert_application_id is not null and partner_application_id is null)
    or
    (expert_application_id is null and partner_application_id is not null)
  )
);

create unique index if not exists referral_codes_code_uidx
  on public.referral_codes (upper(code));
create unique index if not exists referral_codes_slug_uidx
  on public.referral_codes (lower(slug)) where slug is not null;
create index if not exists referral_codes_expert_idx
  on public.referral_codes (expert_application_id);
create index if not exists referral_codes_partner_idx
  on public.referral_codes (partner_application_id);

-- Stamped once a referred member signs up. Nullable + no FK enforcement
-- to `members` beyond the reference itself, since the member-signup flow
-- that stamps this doesn't exist yet in this phase.
create table if not exists public.referral_signups (
  id            uuid primary key default gen_random_uuid(),
  code_id       uuid not null references public.referral_codes(id) on delete cascade,
  member_id     uuid references public.members(id) on delete set null,
  referred_name  text,
  referred_email text,
  converted_at  timestamptz,        -- set by an admin (or a future webhook) once they pay
  created_at    timestamptz not null default now()
);

create index if not exists referral_signups_code_idx
  on public.referral_signups (code_id, created_at desc);

alter table public.referral_codes   enable row level security;
alter table public.referral_signups enable row level security;
