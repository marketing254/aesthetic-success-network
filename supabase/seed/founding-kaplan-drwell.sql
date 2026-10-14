-- =====================================================================
-- ASN founding expert: Dr. Jonathan Kaplan (expert) and DrWell (company)
-- Puts both on the public site: /experts and /companies.
-- Run AFTER all migrations (0001 to 0074). Re-runnable.
-- Paste into Supabase Dashboard -> SQL Editor -> New query -> Run.
--
-- Nothing to fill in. His details are read from what is already in the
-- database, in this order:
--   1. his founding invite        (public.founding_invites)
--   2. his expert application     (public.expert_applications)
--   3. DrWell's company application (public.vendor_applications)
--   4. an existing expert row     (public.experts)
-- matched on the name "Kaplan" or the company "DrWell". The script stops
-- with a clear error if it finds nothing.
--
-- One email for both rows = one sign-in for both portals. When he accepts
-- his founding invite (same email), the acceptance updates these rows with
-- his signed agreement and billing; nothing here needs undoing.
-- Not billing-exempt, no Stripe customer. Images are site paths.
--
-- Optional, run first to see what will be used:
--   select 'invite' src, email, full_name, company_name, website, calendar_link, category, status, created_at
--     from public.founding_invites where full_name ilike '%kaplan%' or company_name ilike '%drwell%'
--   union all
--   select 'expert app', email, full_name, company_name, website, booking_link, specialty, status::text, created_at
--     from public.expert_applications where full_name ilike '%kaplan%' or company_name ilike '%drwell%'
--   union all
--   select 'company app', contact_email, contact_name, company_name, website, calendar_link, category, status::text, created_at
--     from public.vendor_applications where contact_name ilike '%kaplan%' or company_name ilike '%drwell%'
--   order by created_at desc;
-- =====================================================================

do $$
declare
  fi  public.founding_invites%rowtype;
  ea  public.expert_applications%rowtype;
  va  public.vendor_applications%rowtype;
  ex  public.experts%rowtype;

  v_email     text;
  v_phone     text;
  v_website   text;
  v_booking   text;
  v_category  text;
  v_desc      text;
  v_bio       text;
  v_specialty text;
  v_plan      text;
  v_expert    uuid;
  v_vendor    uuid;
begin
  select * into fi from public.founding_invites
   where (full_name ilike '%kaplan%' or company_name ilike '%drwell%') and status <> 'revoked'
   order by (status = 'accepted') desc, created_at desc limit 1;

  select * into ea from public.expert_applications
   where full_name ilike '%kaplan%' or company_name ilike '%drwell%'
   order by created_at desc limit 1;

  select * into va from public.vendor_applications
   where contact_name ilike '%kaplan%' or company_name ilike '%drwell%'
   order by created_at desc limit 1;

  select * into ex from public.experts
   where full_name ilike '%kaplan%' or company_name ilike '%drwell%'
   order by created_at desc limit 1;

  v_email := lower(trim(coalesce(nullif(ex.email::text, ''), nullif(fi.email::text, ''), nullif(ea.email::text, ''), nullif(va.contact_email::text, ''))));
  if v_email is null or v_email not like '%@%' then
    raise exception 'No record for Dr. Kaplan / DrWell found (founding_invites, expert_applications, vendor_applications, experts). Run the optional query at the top to check the spelling.';
  end if;

  v_phone     := coalesce(nullif(fi.phone, ''), nullif(ea.phone, ''), nullif(va.contact_phone, ''));
  v_website   := coalesce(nullif(ex.website, ''), nullif(fi.website, ''), nullif(ea.website, ''), nullif(va.website, ''));
  v_booking   := coalesce(nullif(ex.booking_link, ''), nullif(fi.calendar_link, ''), nullif(ea.booking_link, ''), nullif(va.calendar_link, ''));
  v_category  := coalesce(nullif(fi.category, ''), nullif(va.category, ''), 'Coaching & consulting');
  v_specialty := coalesce(nullif(ex.specialty, ''), nullif(ea.specialty, ''), 'Weight & wellness, subscription practice');
  v_plan      := case when fi.pricing_plan = 'flat' then 'flat' else 'ladder' end;

  -- Bio and company description: what he gave us first; the fallback uses
  -- only facts from his Protocol cards (confirm with Lester).
  v_bio := coalesce(nullif(ex.bio, ''), nullif(ea.bio, ''),
    'Dr. Jonathan Kaplan is a board-certified plastic surgeon and the founder and CEO of DrWell. For Aesthetic Success Network members he teaches two Protocols: The Weight & Wellness Service Line Protocol, on adding a medical weight program your patients trust and running it like real care, and The Subscription Practice Protocol, on automating recurring programs while keeping the patient relationship.');
  v_desc := coalesce(nullif(fi.description, ''), nullif(va.description, ''),
    'DrWell was founded by Dr. Jonathan Kaplan, board-certified plastic surgeon. Its focus is medical weight and wellness programs and recurring, subscription-based care for aesthetic practices.');

  -- ------------------------------------------------------------------
  -- 1. Dr. Jonathan Kaplan, expert
  -- ------------------------------------------------------------------
  insert into public.experts (
    email, full_name, display_name, company_name, specialty, bio, website, booking_link,
    headshot_url, status, activated_at, months_in_program
  ) values (
    v_email, 'Dr. Jonathan Kaplan', 'Dr. Jonathan Kaplan', 'DrWell', v_specialty, v_bio, v_website, v_booking,
    '/team/jonathan-kaplan.jpg', 'active', now(), 0
  )
  on conflict (email) do update set
    full_name     = excluded.full_name,
    display_name  = excluded.display_name,
    company_name  = excluded.company_name,
    specialty     = coalesce(nullif(public.experts.specialty, ''), excluded.specialty),
    bio           = coalesce(nullif(public.experts.bio, ''), excluded.bio),
    website       = coalesce(public.experts.website, excluded.website),
    booking_link  = coalesce(public.experts.booking_link, excluded.booking_link),
    headshot_url  = excluded.headshot_url,
    status        = 'active',
    activated_at  = coalesce(public.experts.activated_at, now())
  returning id into v_expert;

  -- ------------------------------------------------------------------
  -- 2. DrWell, company (same email: one sign-in for both portals)
  -- ------------------------------------------------------------------
  insert into public.vendors (
    company_name, display_name, category, description, logo_url, website,
    contact_name, contact_email, contact_phone, billing_email, calendar_link,
    plan_id, status, verified, billing_plan, months_in_program
  ) values (
    'DrWell', 'DrWell', v_category, v_desc, '/logos/drwell.png', v_website,
    'Dr. Jonathan Kaplan', v_email, v_phone, v_email, v_booking,
    'founding', 'approved', true, v_plan, 0
  )
  on conflict (contact_email) do update set
    company_name  = excluded.company_name,
    display_name  = excluded.display_name,
    category      = coalesce(nullif(public.vendors.category, ''), excluded.category),
    description   = coalesce(nullif(public.vendors.description, ''), excluded.description),
    logo_url      = excluded.logo_url,
    website       = coalesce(public.vendors.website, excluded.website),
    contact_phone = coalesce(public.vendors.contact_phone, excluded.contact_phone),
    calendar_link = coalesce(public.vendors.calendar_link, excluded.calendar_link),
    status        = 'approved',
    verified      = true
  returning id into v_vendor;

  -- Link his sign-in if the auth user already exists.
  update public.experts e set auth_user_id = u.id
    from auth.users u
   where e.id = v_expert and lower(u.email) = v_email and e.auth_user_id is null;
  update public.vendors v set auth_user_id = u.id
    from auth.users u
   where v.id = v_vendor and lower(u.email) = v_email and v.auth_user_id is null;

  raise notice 'Done: expert % and DrWell % listed for %', v_expert, v_vendor, v_email;
end $$;

-- Check (both rows should come back; /experts and /companies show them right away):
--   select email, status, headshot_url, website, booking_link from public.experts where full_name = 'Dr. Jonathan Kaplan';
--   select contact_email, status, verified, logo_url, category, billing_plan from public.vendors where company_name = 'DrWell';
