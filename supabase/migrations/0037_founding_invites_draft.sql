-- =====================================================================
-- ASN — Founding invites: DRAFT status + admin-controlled sending
-- Run after 0036_founding_invites.sql.
--
-- Safety change: admin-added founding invitees are REAL, hand-picked
-- partners/experts. Adding one must NEVER auto-email or approve anyone.
-- New invites are created as 'draft' — they sit in the admin panel until
-- an admin explicitly clicks "Send invite," which is the only action that
-- renders the personalized agreement + emails the private link.
--
-- Lifecycle is now: draft -> sent -> viewed -> accepted (or revoked).
-- =====================================================================

-- Widen the status check to include 'draft'.
alter table public.founding_invites
  drop constraint if exists founding_invites_status_check;

alter table public.founding_invites
  add constraint founding_invites_status_check
  check (status in ('draft','sent','viewed','accepted','revoked'));

-- New rows default to draft (nothing is sent on insert).
alter table public.founding_invites
  alter column status set default 'draft';

-- Full intake detail (same field set as the public forms) so admins
-- capture everything up front and nothing is lost to a free-text notes
-- blob. These flow onto the vendor / expert row at acceptance.
alter table public.founding_invites add column if not exists website          text;
alter table public.founding_invites add column if not exists category         text;
alter table public.founding_invites add column if not exists calendar_link    text;
alter table public.founding_invites add column if not exists description      text;
alter table public.founding_invites add column if not exists secondary_email  text;
alter table public.founding_invites add column if not exists secondary_phone  text;
alter table public.founding_invites add column if not exists signer_name      text;
alter table public.founding_invites add column if not exists signer_title     text;
