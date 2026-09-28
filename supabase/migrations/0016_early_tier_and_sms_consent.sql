-- =============================================================
-- 0016 — Early Member tier + SMS consent
--
-- Two unrelated additions bundled because both are tiny:
--
--   1. early_member_locked (boolean) — mirrors founding_member_locked,
--      so we can cap the Early tier at 400 lifetime subscribers and
--      keep their pricing locked. Set by the Stripe webhook on first
--      successful checkout against an early_* plan; never reset.
--
--   2. sms_consent_at + sms_consent_text on both members and
--      waitlist_signups (members source-of-truth, waitlist captured
--      at form submission so we have the evidence trail). Vendors
--      get the same pair so partner SMS hotline replies are covered.
--
--      sms_consent_text stores the EXACT checkbox copy the user
--      accepted — required for TCPA / CASL audits. Update the
--      column verbatim if you change the on-screen copy.
-- =============================================================

-- ── Early Member tier ────────────────────────────────────────
alter table public.members
  add column if not exists early_member_locked boolean not null default false;

-- Quick check for "is this seat sold?" counts.
create index if not exists members_early_locked_idx
  on public.members (early_member_locked)
  where early_member_locked = true;

-- ── SMS consent on members ───────────────────────────────────
alter table public.members
  add column if not exists sms_consent_at   timestamptz,
  add column if not exists sms_consent_text text;

-- ── SMS consent on waitlist (captured at form submission) ────
alter table public.waitlist_signups
  add column if not exists sms_consent_at   timestamptz,
  add column if not exists sms_consent_text text;

-- ── SMS consent on vendor applications + vendors ─────────────
alter table public.vendor_applications
  add column if not exists sms_consent_at   timestamptz,
  add column if not exists sms_consent_text text;

alter table public.vendors
  add column if not exists sms_consent_at   timestamptz,
  add column if not exists sms_consent_text text;
