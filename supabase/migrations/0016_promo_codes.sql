-- ============================================================
-- ASN growth phase · 0016 — promo codes
--
-- Lightweight, standalone promo-code registry for the admin console.
-- An admin can mint a code for a specific expert, a specific partner,
-- or the team itself (no owner), give it a short description of what
-- it unlocks, and toggle it active/inactive.
--
-- This is record-keeping only for this phase: nothing in the Stripe
-- checkout flow reads this table yet (checkout/billing code is out of
-- scope for this port — see src/lib/stripe.ts, which is untouched).
-- Wiring a code up to an actual checkout discount is future work.
-- ============================================================

create table if not exists public.promo_codes (
  id                      uuid primary key default gen_random_uuid(),
  code                    text not null,
  label                   text not null,          -- what this promotes, e.g. "Dr. Chen — 1 month free"
  discount_description    text,                    -- free text, e.g. "1 month free" / "20% off first 3 months"

  -- At most one owner. Neither set = a team/house code.
  expert_application_id   uuid references public.expert_applications(id) on delete set null,
  partner_application_id  uuid references public.partner_applications(id) on delete set null,

  active                  boolean not null default false,
  expires_at              timestamptz,
  max_redemptions         integer,
  redemption_count        integer not null default 0,

  created_by              uuid references public.admin_users(id) on delete set null,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),

  constraint promo_codes_one_owner check (
    expert_application_id is null or partner_application_id is null
  )
);

create unique index if not exists promo_codes_code_uidx
  on public.promo_codes (upper(code));
create index if not exists promo_codes_active_idx
  on public.promo_codes (active, created_at desc);

-- Service-role only — same pattern as every other admin-managed table.
alter table public.promo_codes enable row level security;
