-- ============================================================
-- ASN launch phase · 0007 — portal gate self-read policies
-- The middleware blocks the future portal surfaces (/dashboard,
-- /expert, /vendor) unless the signed-in email is an ACTIVATED
-- member or an APPROVED expert/partner. That check runs with the
-- anon key + the user's session, so each table needs exactly one
-- policy: an authenticated user may read THEIR OWN row (matched by
-- JWT email). Writes remain service-role only (deny-all stands).
-- ============================================================

drop policy if exists members_read_own on public.members;
create policy members_read_own
  on public.members
  for select
  to authenticated
  using (lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')));

drop policy if exists expert_applications_read_own on public.expert_applications;
create policy expert_applications_read_own
  on public.expert_applications
  for select
  to authenticated
  using (lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')));

drop policy if exists partner_applications_read_own on public.partner_applications;
create policy partner_applications_read_own
  on public.partner_applications
  for select
  to authenticated
  using (lower(contact_email) = lower(coalesce(auth.jwt() ->> 'email', '')));
