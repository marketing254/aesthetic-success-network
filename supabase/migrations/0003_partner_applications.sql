-- ============================================================
-- ASN launch phase · 0003 — partner (vendor) applications
-- ============================================================

create table if not exists public.partner_applications (
  id             uuid primary key default gen_random_uuid(),
  company_name   text not null,
  website        text,
  contact_name   text not null,
  contact_role   text,
  contact_email  text not null,
  contact_phone  text,
  category       text,          -- one of the 11 partner categories
  description    text,          -- short company description
  member_deal    text,          -- the member deal they'll offer
  booking_link   text,
  billing_contact text,         -- billing contact after the free period
  agreement_accepted    boolean not null default false,
  agreement_accepted_at timestamptz,
  source         text default 'partners-page',
  ip_hash        text,
  user_agent     text,
  status         text not null default 'new'
                 check (status in ('new','in_review','approved','declined')),
  reviewed_at    timestamptz,
  reviewed_by    text,          -- admin email who last changed the status
  created_at     timestamptz not null default now()
);

-- one application per contact email
create unique index if not exists partner_applications_email_key
  on public.partner_applications (lower(contact_email));

create index if not exists partner_applications_created_at_idx
  on public.partner_applications (created_at desc);

create index if not exists partner_applications_status_idx
  on public.partner_applications (status);

-- RLS: deny-all (service role only).
alter table public.partner_applications enable row level security;
