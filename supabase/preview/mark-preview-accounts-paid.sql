-- =====================================================================
-- ASN — mark the preview accounts as paid (LOCAL / PREVIEW ONLY)
-- Run in the SQL editor AFTER the accounts exist (expert onboarded via
-- admin, company approved via admin). Re-runnable. Never run in production.
--
-- Experts: uses the lifetime-free flag (billing_exempt), which the portal,
-- the API guards and the trial-reminder logic all honour.
-- Companies: there is no exempt flag, so the row is given a 180-day
-- "trialing" subscription shadow, which is exactly what a real
-- sign-and-pay produces. Nothing touches Stripe.
-- =====================================================================

update public.experts
   set billing_exempt = true,
       billing_exempt_reason = coalesce(billing_exempt_reason, 'preview account'),
       billing_exempt_granted_at = coalesce(billing_exempt_granted_at, now()),
       status = 'approved'
 where lower(email) in ('rushdhaakbar82@gmail.com', 'rushdha@ekwa.com');

update public.vendors
   set status = 'approved',
       verified = true,
       subscription_status = 'trialing',
       stripe_subscription_id = coalesce(stripe_subscription_id, 'preview_' || left(id::text, 8)),
       trial_end = coalesce(trial_end, now() + interval '180 days'),
       current_period_end = coalesce(current_period_end, now() + interval '180 days'),
       months_in_program = greatest(coalesce(months_in_program, 0), 1)
 where lower(contact_email) in ('rushdhaakbar82@gmail.com', 'rushdha@ekwa.com');

-- Check:
--   select email, status, billing_exempt from public.experts where lower(email) in ('rushdhaakbar82@gmail.com','rushdha@ekwa.com');
--   select contact_email, status, verified, subscription_status, trial_end from public.vendors where lower(contact_email) in ('rushdhaakbar82@gmail.com','rushdha@ekwa.com');
