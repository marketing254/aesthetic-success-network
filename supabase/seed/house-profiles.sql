-- =====================================================================
-- ASN house profiles: Naren Arulrajah (expert) and Ekwa Marketing Inc. (company)
-- Run AFTER all migrations (0001 to 0073). Re-runnable: every statement
-- updates the row if it already exists.
-- Paste into Supabase Dashboard -> SQL Editor -> New query -> Run.
--
-- BEFORE running: in the Dashboard, Authentication -> Users -> "Add user"
-- (auto confirm) for naren@ekwa.com and helpdesk@ekwa.com. This script
-- links those auth users to the rows so both can sign in with a 6-digit
-- code. If you skip it, the rows still appear in the directories; sign-in
-- simply needs the users added later (re-run this file afterwards).
--
-- Both are house accounts: never billed, no Stripe customer.
--   expert  -> billing_exempt (lifetime free, counts 1 of the 20 slots)
--   company -> subscription shadow "active" with a house id, no Stripe
-- Images are site-relative paths (public/team/naren-arulrajah.jpg
-- and public/ekwa-logo.png), so no storage upload is needed.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Naren Arulrajah, expert
-- ---------------------------------------------------------------------
insert into public.experts (
  email, full_name, display_name, company_name, specialty, bio, website, booking_link,
  headshot_url, status, activated_at, months_in_program,
  billing_exempt, billing_exempt_reason, billing_exempt_granted_at, founding_expert_locked
) values (
  'naren@ekwa.com',
  'Naren Arulrajah',
  'Naren Arulrajah',
  'Ekwa Marketing',
  'Marketing & growth',
  'Naren founded Ekwa Marketing to give healthcare practices a marketing partner that actually moves the needle. Under his leadership, Ekwa has grown into a team that helps practices across dental, veterinary, medical aesthetics, and more get found, get liked, and get chosen.

Ekwa is the best known of what Naren has built, but it isn''t the whole story. He is also a speaker, an author, and a host or regular voice on a range of healthcare podcasts, where he teaches the same system in public. What ties it all together is a simple belief: good practices deserve to grow, and growth shouldn''t be a mystery.

He is just as comfortable talking about the founder journey and giving back as he is about SEO and AI, because to Naren, building a company and building a brand are the same work: earn trust, deliver value, and keep showing up.',
  'https://www.narenarulrajah.com/',
  'https://www.narenarulrajah.com/book',
  '/team/naren-arulrajah.jpg',
  'active',
  now(),
  0,
  true,
  'House expert (Ekwa Marketing founder)',
  now(),
  true
)
on conflict (email) do update set
  full_name = excluded.full_name,
  display_name = excluded.display_name,
  company_name = excluded.company_name,
  specialty = excluded.specialty,
  bio = excluded.bio,
  website = excluded.website,
  booking_link = excluded.booking_link,
  headshot_url = excluded.headshot_url,
  status = 'active',
  activated_at = coalesce(public.experts.activated_at, now()),
  billing_exempt = true,
  billing_exempt_reason = coalesce(public.experts.billing_exempt_reason, excluded.billing_exempt_reason),
  billing_exempt_granted_at = coalesce(public.experts.billing_exempt_granted_at, now()),
  founding_expert_locked = true;

-- Link the auth user (if it has been added in Authentication -> Users).
update public.experts e
   set auth_user_id = u.id
  from auth.users u
 where lower(u.email) = 'naren@ekwa.com'
   and e.email = 'naren@ekwa.com'
   and e.auth_user_id is null;

-- ---------------------------------------------------------------------
-- 2. Ekwa Marketing Inc., company
-- ---------------------------------------------------------------------
insert into public.vendors (
  company_name, display_name, category, description, logo_url, website,
  contact_name, contact_email, contact_phone, billing_email, hotline_email, calendar_link,
  plan_id, status, verified, agreement_version, agreement_signed_at,
  billing_plan, founding_partner_locked, months_in_program,
  subscription_status, stripe_subscription_id
) values (
  'Ekwa Marketing Inc.',
  'Ekwa Marketing Inc.',
  'Marketing & growth',
  'Ekwa Marketing helps healthcare practices attract more patients, grow their online presence, and build stronger, more profitable businesses through digital marketing.',
  '/ekwa-logo.png',
  'https://www.ekwa.com/',
  'Ekwa Helpdesk',
  'helpdesk@ekwa.com',
  '855-971-1519',
  'helpdesk@ekwa.com',
  'helpdesk@ekwa.com',
  'https://www.ekwa.com/marketing-strategy-meeting/',
  'founding',
  'approved',
  true,
  'v4',
  now(),
  'standard',
  true,
  0,
  'active',
  'house_ekwa_marketing'
)
on conflict (contact_email) do update set
  company_name = excluded.company_name,
  display_name = excluded.display_name,
  category = excluded.category,
  description = excluded.description,
  logo_url = excluded.logo_url,
  website = excluded.website,
  contact_name = excluded.contact_name,
  contact_phone = excluded.contact_phone,
  calendar_link = excluded.calendar_link,
  plan_id = 'founding',
  status = 'approved',
  verified = true,
  billing_plan = 'standard',
  founding_partner_locked = true,
  subscription_status = 'active',
  stripe_subscription_id = coalesce(public.vendors.stripe_subscription_id, 'house_ekwa_marketing');

update public.vendors v
   set auth_user_id = u.id
  from auth.users u
 where lower(u.email) = 'helpdesk@ekwa.com'
   and v.contact_email = 'helpdesk@ekwa.com'
   and v.auth_user_id is null;

-- ---------------------------------------------------------------------
-- 3. Ekwa catalog item + two member offers
-- ---------------------------------------------------------------------
do $$
declare
  v_vendor uuid;
  v_item uuid;
begin
  select id into v_vendor from public.vendors where contact_email = 'helpdesk@ekwa.com';
  if v_vendor is null then
    raise exception 'Ekwa vendor row not found';
  end if;

  select id into v_item from public.catalog_items
   where vendor_id = v_vendor and name = 'Digital Marketing Program';
  if v_item is null then
    insert into public.catalog_items (vendor_id, type, name, tagline, description, category, price_label, review_status, approved_at)
    values (
      v_vendor, 'service', 'Digital Marketing Program', 'Get found, get liked, get chosen',
      'Ekwa''s full digital marketing program for healthcare practices: SEO, website, content, and patient-acquisition systems that grow your online presence and your practice.',
      'Marketing & growth', 'Custom pricing', 'approved', now()
    )
    returning id into v_item;
  else
    update public.catalog_items
       set tagline = 'Get found, get liked, get chosen',
           description = 'Ekwa''s full digital marketing program for healthcare practices: SEO, website, content, and patient-acquisition systems that grow your online presence and your practice.',
           category = 'Marketing & growth', price_label = 'Custom pricing',
           review_status = 'approved', approved_at = coalesce(approved_at, now())
     where id = v_item;
  end if;

  -- Offer 1
  if not exists (select 1 from public.offers where catalog_item_id = v_item and headline = '$250 off your first 3 months') then
    insert into public.offers (vendor_id, catalog_item_id, headline, discount_value, description, terms, valid_from, valid_to, redemption_limit_per_member, review_status, approved_at)
    values (
      v_vendor, v_item, '$250 off your first 3 months', '$250 off',
      'Enjoy $250 off on your first 3 months of service on your marketing bill.',
      'For Aesthetic Success Network members. Applies to your marketing bill for the first 3 months of service. Cannot be combined with other promotions unless stated.',
      current_date, date '2030-12-31', 'unlimited', 'approved', now()
    );
  end if;

  -- Offer 2
  if not exists (select 1 from public.offers where catalog_item_id = v_item and headline = 'Complimentary Complete Marketing Audit (worth $900)') then
    insert into public.offers (vendor_id, catalog_item_id, headline, discount_value, description, terms, valid_from, valid_to, redemption_limit_per_member, review_status, approved_at)
    values (
      v_vendor, v_item, 'Complimentary Complete Marketing Audit (worth $900)', 'Free, worth $900',
      'A Complete Marketing Audit worth $900, complimentary for Aesthetic Success Network members. Book at https://www.ekwa.com/marketing-strategy-meeting/',
      'For Aesthetic Success Network members. One audit per practice. Booked via the marketing strategy meeting link.',
      current_date, date '2030-12-31', 'unlimited', 'approved', now()
    );
  end if;

  update public.catalog_items
     set offer_count = (select count(*) from public.offers where catalog_item_id = v_item and review_status = 'approved')
   where id = v_item;
end $$;

-- ---------------------------------------------------------------------
-- 4. Referral pages (www.aestheticsuccessnetwork.com/<slug>)
--    Naren: /narenarulrajah   Ekwa: /ekwamarketing
-- ---------------------------------------------------------------------
insert into public.referral_codes (expert_id, code, slug, active)
select id, 'NARE2CRK', 'narenarulrajah', true from public.experts where email = 'naren@ekwa.com'
on conflict (code) do update set slug = excluded.slug, active = true;

insert into public.referral_codes (vendor_id, code, slug, active)
select id, 'EKWA2ASN', 'ekwamarketing', true from public.vendors where contact_email = 'helpdesk@ekwa.com'
on conflict (code) do update set slug = excluded.slug, active = true;

-- ---------------------------------------------------------------------
-- 5. Promo code NAREN (six months free for members he refers; DMN had the
--    same). Member checkout is paused until launch, so nothing can be
--    redeemed before then. Set active = false here if you do not want it.
-- ---------------------------------------------------------------------
insert into public.member_promo_codes (code, label, expert_id, active, trial_days, max_uses)
select 'NAREN', 'Naren Arulrajah, Ekwa Marketing', id, true, 180, 10 from public.experts where email = 'naren@ekwa.com'
on conflict (code) do update set label = excluded.label, expert_id = excluded.expert_id, trial_days = 180, max_uses = 10;

-- Check:
--   select email, status, billing_exempt, auth_user_id from public.experts where email = 'naren@ekwa.com';
--   select contact_email, status, verified, subscription_status, auth_user_id from public.vendors where contact_email = 'helpdesk@ekwa.com';
--   select code, slug, expert_id, vendor_id from public.referral_codes where code in ('NARE2CRK','EKWA2ASN');
