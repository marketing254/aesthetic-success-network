-- ASN — Meta paid-ads purchase channel (additive only, safe on live data)
--
-- The paid-ads landing page (/start) signs members up in one step and
-- needs to store acquisition + consent context on the member row:
--   * which ad brought them in (UTMs + Meta click id)
--   * the browser identifiers Meta's Conversions API wants for match
--     quality (fbp/fbc cookies)
--   * proof of Member Agreement acceptance (version + timestamp)
--   * which channel created the account (organic form vs paid ads)
--
-- All columns are nullable — existing rows and the organic signup flow
-- are unaffected.

alter table public.members add column if not exists signup_channel text;
alter table public.members add column if not exists utm_source text;
alter table public.members add column if not exists utm_medium text;
alter table public.members add column if not exists utm_campaign text;
alter table public.members add column if not exists utm_content text;
alter table public.members add column if not exists utm_term text;
alter table public.members add column if not exists meta_fbclid text;
alter table public.members add column if not exists meta_fbp text;
alter table public.members add column if not exists meta_fbc text;
alter table public.members add column if not exists agreement_version text;
alter table public.members add column if not exists agreement_accepted_at timestamptz;

comment on column public.members.signup_channel is
  'How the account was created: null/organic = website forms, meta_ads = the paid-ads one-page checkout.';
comment on column public.members.meta_fbclid is
  'Meta ad click id from the landing URL (?fbclid=). Stored for Conversions API match quality.';
comment on column public.members.agreement_accepted_at is
  'When the member ticked the Member Agreement box at the paid-ads checkout.';
