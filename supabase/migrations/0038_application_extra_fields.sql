-- =====================================================================
-- ASN — Persist application fields that the forms collect but that had
-- no column to land in (they were only ever emailed to the team).
-- Run after 0037_founding_invites_draft.sql.
--
--   Expert form:  "also list my company as a partner", the company's
--                 member offer, and "consider me as a Founding Expert".
--   Partner form: the exclusive member offer, and "I'm also an
--                 individual expert".
-- =====================================================================

alter table public.expert_applications
  add column if not exists also_partner       boolean not null default false;
alter table public.expert_applications
  add column if not exists company_offer       text;
alter table public.expert_applications
  add column if not exists considered_founding boolean not null default false;

alter table public.vendor_applications
  add column if not exists member_offer text;
alter table public.vendor_applications
  add column if not exists also_expert  boolean not null default false;
