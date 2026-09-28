-- =====================================================================
-- ASN — application form fields the DMN schema did not have
-- Run AFTER 0068_notifications_reconcile.sql. Idempotent.
--
-- The ASN public forms (home waitlist, /experts, /partners) collect a few
-- fields DMN never asked for. Store them as real columns so the admin
-- console and exports can read them.
-- =====================================================================

-- Home page waitlist form
alter table public.waitlist_signups
  add column if not exists first_name            text,
  add column if not exists last_name             text,
  add column if not exists practice_role         text,   -- Dermatologist, Plastic surgeon, Med spa owner, ...
  add column if not exists locations             text,   -- "1", "2–3", "4–9", "10+"
  add column if not exists challenge             text,   -- free text, up to 2000 chars
  add column if not exists agreement_accepted    boolean not null default false,
  add column if not exists agreement_accepted_at timestamptz;

comment on column public.waitlist_signups.practice_role is 'ASN home form: "You are a..." selection.';
comment on column public.waitlist_signups.challenge is 'ASN home form: "Your biggest practice challenge right now" (free text).';

-- Expert application form
alter table public.expert_applications
  add column if not exists first_name                  text,
  add column if not exists last_name                   text,
  add column if not exists bio                         text,   -- short bio + title / credentials
  add column if not exists sample_link                 text,   -- sample recording or content URL
  add column if not exists paid_courses                text,   -- Yes / No / Maybe later
  add column if not exists content_ownership_confirmed boolean not null default false;

comment on column public.expert_applications.content_ownership_confirmed is 'ASN experts form: "I confirm the content I share is mine to publish to members."';

-- Partner application form
alter table public.vendor_applications
  add column if not exists contact_role text;   -- the contact person's role at the company

comment on column public.vendor_applications.contact_role is 'ASN partners form: contact person role (also copied to signature_title).';

notify pgrst, 'reload schema';
