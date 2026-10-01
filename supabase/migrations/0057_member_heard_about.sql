-- =====================================================================
-- ASN — "How did you hear about us?" on member signup
-- Run after 0056_onboarding_sequence.sql.
--
-- New dropdown on /join/member (Business of Aesthetics, Ekwa Marketing, an expert,
-- a partner company, Google, social media, a friend, other + free text). Stored on the member row for the admin
-- detail drawer and acquisition reporting. Additive nullable column;
-- the signup route writes it best-effort (works before AND after this
-- migration runs).
-- =====================================================================

alter table public.members add column if not exists heard_about text;
comment on column public.members.heard_about is 'How the member heard about ASN — from the signup form dropdown (free text when "Other").';
