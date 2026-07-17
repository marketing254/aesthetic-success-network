-- ============================================================
-- ASN launch phase · 0005 — Member Agreement acceptance on the waitlist
-- Members now tick "I agree to the Member Agreement" on the waitlist
-- form (same acceptance record as experts/partners). Safe to run on a
-- database created before or after this change.
-- ============================================================

alter table public.waitlist_signups
  add column if not exists agreement_accepted    boolean not null default false,
  add column if not exists agreement_accepted_at timestamptz;
