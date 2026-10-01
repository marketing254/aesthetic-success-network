-- =====================================================================
-- ASN: wipe every expert and company so provider testing starts from scratch.
-- Keeps: admins, members, the waitlist, migrations, settings.
-- Removes: experts, expert applications, companies (vendors), company
-- applications, catalog items, offers, redemptions, founding invites,
-- invite links, referral codes, promo codes tied to a provider, and the
-- auth users that belonged to those experts and companies.
-- Paste into Supabase Dashboard -> SQL Editor -> New query -> Run.
-- Re-runnable. NEVER run in production once real providers exist.
--
-- Afterwards, re-run supabase/seed/house-profiles.sql to put Naren and
-- Ekwa back.
-- =====================================================================

begin;

-- Auth users of the experts and companies being removed (admins are
-- protected: an email that is also in admin_users is never deleted).
create temp table _provider_emails on commit drop as
  select lower(email) as email from public.experts
  union
  select lower(contact_email) from public.vendors
  union
  select lower(billing_email) from public.vendors where billing_email is not null
  union
  select lower(email) from public.expert_applications
  union
  select lower(contact_email) from public.vendor_applications;

delete from _provider_emails
 where email in (select lower(email) from public.admin_users)
    or email in (select lower(email) from public.members);

-- Tables that reference providers without cascade.
delete from public.redemptions;
delete from public.invite_links where expert_id is not null or vendor_id is not null;

-- Provider-scoped rows (most cascade from experts / vendors, listed for clarity).
delete from public.offers;
delete from public.catalog_items;
delete from public.referral_codes;
delete from public.member_promo_codes where expert_id is not null or vendor_id is not null;
delete from public.founding_invites;

-- The providers themselves and their applications.
delete from public.vendors;
delete from public.experts;
delete from public.vendor_applications;
delete from public.expert_applications;

-- Their sign-ins.
delete from auth.users where lower(email) in (select email from _provider_emails);

commit;

-- Check (all should be 0, admins untouched):
--   select (select count(*) from public.experts) experts,
--          (select count(*) from public.vendors) vendors,
--          (select count(*) from public.founding_invites) invites,
--          (select count(*) from public.admin_users) admins;
