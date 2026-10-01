-- =====================================================================
-- ASN: waitlist launch email stamp
-- Run AFTER 0071 (and 0072 if it exists).
-- Paste into Supabase Dashboard -> SQL Editor -> New query -> Run.
--
-- Members only join the waitlist until the launch. When the team opens
-- the doors, the admin Waitlist page sends ONE "doors are open" email
-- per signup (POST /api/admin/waitlist/launch-email). The send is stamped
-- here so a second click never emails the same person twice.
-- Idempotent.
-- =====================================================================

alter table public.waitlist_signups
  add column if not exists launch_email_sent_at timestamptz;

comment on column public.waitlist_signups.launch_email_sent_at is
  'When the "doors are open" launch email was sent from the admin Waitlist page. Null until then.';

notify pgrst, 'reload schema';
