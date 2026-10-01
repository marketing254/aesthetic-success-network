-- =====================================================================
-- ASN — Security follow-ups (second pass after 0067_asn_security_hardening)
-- Run AFTER 0071_provider_free_period.sql.
-- Paste into Supabase Dashboard → SQL Editor → New query → Run.
--
-- Every statement here is idempotent (if exists / or replace / drop
-- policy if exists + create), so re-running the file is safe. Nothing
-- the service role does changes: API routes bypass RLS and keep their
-- table-wide grants from 0004. Only what the PUBLIC anon key and a
-- signed-in browser session can read is tightened.
--
-- Sections
--   (a) vendors: the anon key could read EVERY column of an approved
--       company (contact_email, contact_phone, billing_email,
--       stripe_customer_id, card_last4, agreement_ip_hash …) and any
--       signed-in user could do the same. anon now gets the public-
--       directory columns only; authenticated reads its own row or is
--       an admin. The public directory + /companies/[id] already read
--       through the service role, so nothing on the site changes.
--   (b) offers / offer_media / catalog_items / catalog_media: approved
--       rows (promo codes included) were readable with the anon key and
--       by ANY signed-in account (job seeker, unpaid member, other
--       company). They are a paid member benefit: no anon read; a
--       signed-in reader must be the owning company, an admin, or an
--       active PAID member (new helper is_paid_member()).
--   (c) vendor_applications: close the direct anon INSERT path. The
--       only writer is /api/join/partner/apply (service role, rate
--       limited); the open policy let anyone with the anon key insert
--       arbitrary PII rows around the limiter.
--   (d) waitlist_signups: drop the dead anon/authenticated INSERT grant
--       (0004 noted it was only safe because no policy exists).
-- =====================================================================


-- ---------------------------------------------------------------------
-- (0) Helper: is the caller an active, PAID member?
--     Mirrors requirePaidMember / requireMemberOrAdminPreview in
--     src/lib/auth/guards.ts: active members row, account_type =
--     'member' (job seekers excluded), subscription active or trialing.
--     security definer so it can read members regardless of the
--     caller's own members policies; stable so Postgres caches it
--     within a statement.
-- ---------------------------------------------------------------------
create or replace function public.is_paid_member()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
      from public.members m
     where m.auth_user_id = auth.uid()
       and m.status = 'active'
       and m.account_type = 'member'
       and m.subscription_status in ('active', 'trialing')
  );
$$;

revoke all on function public.is_paid_member() from public;
grant execute on function public.is_paid_member() to authenticated;

comment on function public.is_paid_member() is
  'True when auth.uid() is an active members row with account_type = member and an active/trialing subscription. Used by member-benefit RLS policies.';


-- ---------------------------------------------------------------------
-- (a) vendors — column-level anon grant + own-row authenticated read.
--
--     0004 granted whole-table SELECT to anon and authenticated, and
--     0003's vendors_select_public / vendors_select_authed exposed every
--     approved + verified row to both. The row filter was right; the
--     column exposure was not. Public-safe columns are exactly what
--     /api/directory/partners and /companies/[id] render.
--
--     vendors_select_public (anon, approved + verified) is kept as the
--     row filter; the grant below is what limits the columns.
--     vendors_update_self / vendors_update_admin / vendors_insert_admin
--     are untouched (the 0067/0070/0071 trigger pins the privileged
--     columns on client updates).
-- ---------------------------------------------------------------------
revoke all on public.vendors from anon;
grant select (
  id, company_name, display_name, category, description,
  logo_url, avatar_url, website, status, verified, billing_parent_id,
  created_at
) on public.vendors to anon;

drop policy if exists vendors_select_authed on public.vendors;
create policy vendors_select_authed
  on public.vendors
  for select
  to authenticated
  using (
    public.is_admin()
    or auth_user_id = (select auth.uid())
  );


-- ---------------------------------------------------------------------
-- (b) offers / offer_media / catalog_items / catalog_media
--
--     No anon read at all (drop the anon policies AND the grants, so a
--     future policy cannot silently re-open them). Signed-in reads:
--     owning company (current_vendor_id()), admin, or an active paid
--     member for approved rows. The insert / update / delete policies
--     from 0003 + 0007 (own company, publish-gated) are untouched.
-- ---------------------------------------------------------------------
drop policy if exists offers_select_public   on public.offers;
drop policy if exists catalog_select_public  on public.catalog_items;
revoke all on public.offers        from anon;
revoke all on public.offer_media   from anon;
revoke all on public.catalog_items from anon;
revoke all on public.catalog_media from anon;

drop policy if exists offers_select_authed on public.offers;
create policy offers_select_authed
  on public.offers
  for select
  to authenticated
  using (
    public.is_admin()
    or vendor_id = public.current_vendor_id()
    or (
      review_status = 'approved'
      and current_date between valid_from and valid_to
      and public.is_paid_member()
    )
  );

drop policy if exists catalog_select_authed on public.catalog_items;
create policy catalog_select_authed
  on public.catalog_items
  for select
  to authenticated
  using (
    public.is_admin()
    or vendor_id = public.current_vendor_id()
    or (review_status = 'approved' and public.is_paid_member())
  );

drop policy if exists catalog_media_select on public.catalog_media;
create policy catalog_media_select
  on public.catalog_media
  for select
  to authenticated
  using (
    exists (
      select 1 from public.catalog_items ci
       where ci.id = catalog_media.catalog_item_id
         and (
              public.is_admin()
           or ci.vendor_id = public.current_vendor_id()
           or (ci.review_status = 'approved' and public.is_paid_member())
         )
    )
  );

drop policy if exists offer_media_select on public.offer_media;
create policy offer_media_select
  on public.offer_media
  for select
  to authenticated
  using (
    exists (
      select 1 from public.offers o
       where o.id = offer_media.offer_id
         and (
              public.is_admin()
           or o.vendor_id = public.current_vendor_id()
           or (
                o.review_status = 'approved'
                and current_date between o.valid_from and o.valid_to
                and public.is_paid_member()
              )
         )
    )
  );


-- ---------------------------------------------------------------------
-- (c) vendor_applications — no direct client insert.
--     The public form posts to /api/join/partner/apply, which writes
--     with the service role behind checkRateLimit(). The 0003 policy
--     `with check (true)` + 0004's anon INSERT grant was a second,
--     unlimited door into the same table. vendor_apps_select_owner and
--     vendor_apps_update_admin stay as they were.
-- ---------------------------------------------------------------------
drop policy if exists vendor_apps_insert_public on public.vendor_applications;
revoke insert on public.vendor_applications from anon, authenticated;


-- ---------------------------------------------------------------------
-- (d) waitlist_signups — remove the dead INSERT grant. RLS is on with
--     no insert policy, so this changes nothing today; it just stops a
--     future policy from re-opening a direct anon insert by accident.
-- ---------------------------------------------------------------------
revoke insert on public.waitlist_signups from anon, authenticated;


notify pgrst, 'reload schema';
