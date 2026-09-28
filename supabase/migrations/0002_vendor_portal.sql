-- =====================================================================
-- ASN — Vendor portal schema (Phase 1)
-- Run this AFTER 0001_waitlist.sql.
-- Paste into Supabase Dashboard → SQL Editor → New query → Run.
-- =====================================================================

create extension if not exists "pgcrypto";
create extension if not exists "citext";

-- =====================================================================
-- ENUMS
-- =====================================================================

do $$ begin
  if not exists (select 1 from pg_type where typname = 'vendor_status') then
    create type vendor_status as enum (
      'pending_review',
      'approved',
      'rejected',
      'suspended',
      'churned'
    );
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_type where typname = 'catalog_item_type') then
    create type catalog_item_type as enum ('service', 'product', 'course');
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_type where typname = 'review_status') then
    create type review_status as enum (
      'draft',
      'pending_review',
      'approved',
      'rejected',
      'needs_changes'
    );
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_type where typname = 'redemption_status') then
    create type redemption_status as enum (
      'pending',
      'confirmed',
      'disputed',
      'voided'
    );
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_type where typname = 'admin_role') then
    create type admin_role as enum ('owner', 'admin', 'reviewer', 'support');
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_type where typname = 'member_status') then
    create type member_status as enum (
      'waitlist',
      'invited',
      'active',
      'paused',
      'churned'
    );
  end if;
end $$;

-- =====================================================================
-- VENDORS (approved partners)
-- =====================================================================

create table if not exists public.vendors (
  id                    uuid primary key default gen_random_uuid(),
  auth_user_id          uuid references auth.users (id) on delete set null,

  -- Company
  company_name          text not null check (char_length(company_name) between 2 and 200),
  display_name          text not null check (char_length(display_name) between 2 and 120),
  category              text,
  website               text,
  description           text check (char_length(description) <= 2000),
  logo_url              text,

  -- Contact (primary)
  contact_name          text not null,
  contact_email         citext not null unique,
  contact_phone         text,
  billing_email         citext,

  -- Operational
  hotline_email         citext,
  calendar_link         text,

  -- Plan
  plan_id               text default 'founding',
  months_in_program     int  default 0 check (months_in_program >= 0),

  -- Status
  status                vendor_status not null default 'approved',
  verified              boolean not null default false,

  -- Agreement
  agreement_signed_at   timestamptz,
  agreement_version     text default 'v1.0',

  -- Tracking
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index if not exists vendors_status_idx        on public.vendors (status);
create index if not exists vendors_auth_user_id_idx  on public.vendors (auth_user_id);
create index if not exists vendors_category_idx      on public.vendors (category);

-- =====================================================================
-- VENDOR APPLICATIONS (incoming signups awaiting approval)
-- =====================================================================

create table if not exists public.vendor_applications (
  id                    uuid primary key default gen_random_uuid(),

  -- Company
  company_name          text not null check (char_length(company_name) between 2 and 200),
  category              text,
  website               text,
  description           text check (char_length(description) <= 2000),

  -- Contact
  contact_name          text not null,
  contact_email         citext not null,
  contact_phone         text,
  secondary_email       citext,
  secondary_phone       text,

  -- Signing
  signature_name        text,
  signature_title       text,
  agreement_version     text default 'v1.0',
  agreed_to_terms       boolean not null default false,
  confirmed_authority   boolean not null default false,

  -- Operational
  plan_id               text default 'founding',
  source                text,
  hotline_email         citext,
  calendar_link         text,

  -- Review
  status                vendor_status not null default 'pending_review',
  review_note           text,
  reviewed_at           timestamptz,
  reviewed_by           uuid,  -- FK to admin_users.id, set after admin_users table exists

  -- Link to approved vendor (after promotion)
  vendor_id             uuid references public.vendors (id) on delete set null,

  -- Tracking
  ip_hash               text,
  user_agent            text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index if not exists vendor_apps_email_idx       on public.vendor_applications (contact_email);
create index if not exists vendor_apps_status_idx      on public.vendor_applications (status);
create index if not exists vendor_apps_created_at_idx  on public.vendor_applications (created_at desc);

-- =====================================================================
-- CATALOG ITEMS (services / products / courses listed by a vendor)
-- =====================================================================

create table if not exists public.catalog_items (
  id                          uuid primary key default gen_random_uuid(),
  vendor_id                   uuid not null references public.vendors (id) on delete cascade,

  -- Basics
  type                        catalog_item_type not null,
  name                        text not null check (char_length(name) between 3 and 200),
  tagline                     text check (char_length(tagline) <= 240),
  description                 text not null check (char_length(description) between 20 and 4000),
  category                    text not null,
  price_label                 text not null check (char_length(price_label) <= 60),

  -- Course-only metadata
  duration_hours              numeric(6, 2),
  module_count                int,
  ce_credits                  int,

  -- Lists
  highlights                  text[] default '{}',
  tags                        text[] default '{}',

  -- Review
  review_status               review_status not null default 'draft',
  review_note                 text,
  reviewed_at                 timestamptz,
  reviewed_by                 uuid,  -- FK added later
  submitted_for_review_at     timestamptz,
  approved_at                 timestamptz,

  -- Derived (cached for UI)
  offer_count                 int  not null default 0 check (offer_count >= 0),
  redemptions_lifetime        int  not null default 0 check (redemptions_lifetime >= 0),

  -- Tracking
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now()
);

create index if not exists catalog_vendor_id_idx      on public.catalog_items (vendor_id);
create index if not exists catalog_type_idx           on public.catalog_items (type);
create index if not exists catalog_review_status_idx  on public.catalog_items (review_status);
create index if not exists catalog_approved_idx
  on public.catalog_items (approved_at desc)
  where review_status = 'approved';

-- =====================================================================
-- CATALOG MEDIA (images + videos attached to catalog items)
-- =====================================================================

create table if not exists public.catalog_media (
  id                uuid primary key default gen_random_uuid(),
  catalog_item_id   uuid not null references public.catalog_items (id) on delete cascade,

  -- Media
  kind              text not null check (kind in ('image', 'video')),
  url               text not null,
  thumbnail_url     text,
  caption           text check (char_length(caption) <= 240),

  -- Video-only
  duration_label    text check (char_length(duration_label) <= 16),

  -- Storage metadata
  mime_type         text,
  file_size_bytes   bigint check (file_size_bytes >= 0),
  width             int,
  height            int,

  -- Ordering within the gallery
  position          int not null default 0,

  created_at        timestamptz not null default now()
);

create index if not exists catalog_media_item_idx on public.catalog_media (catalog_item_id, position);

-- =====================================================================
-- OFFERS (discounts attached to catalog items)
-- =====================================================================

create table if not exists public.offers (
  id                              uuid primary key default gen_random_uuid(),
  vendor_id                       uuid not null references public.vendors (id) on delete cascade,
  catalog_item_id                 uuid not null references public.catalog_items (id) on delete cascade,

  -- Content
  headline                        text not null check (char_length(headline) between 5 and 160),
  discount_value                  text not null,
  promo_code                      text,
  description                     text not null check (char_length(description) between 10 and 1000),
  terms                           text not null check (char_length(terms) between 10 and 4000),

  -- Validity
  valid_from                      date not null,
  valid_to                        date not null,
  redemption_limit_per_member     text not null default 'unlimited',

  -- Review
  review_status                   review_status not null default 'draft',
  review_note                     text,
  reviewed_at                     timestamptz,
  reviewed_by                     uuid,
  submitted_for_review_at         timestamptz,
  approved_at                     timestamptz,

  -- Tracking
  created_at                      timestamptz not null default now(),
  updated_at                      timestamptz not null default now(),

  constraint offers_valid_dates check (valid_to >= valid_from)
);

create index if not exists offers_vendor_id_idx        on public.offers (vendor_id);
create index if not exists offers_catalog_item_id_idx  on public.offers (catalog_item_id);
create index if not exists offers_review_status_idx    on public.offers (review_status);
create index if not exists offers_validity_idx         on public.offers (valid_from, valid_to);
create index if not exists offers_live_idx
  on public.offers (catalog_item_id)
  where review_status = 'approved';

-- =====================================================================
-- OFFER MEDIA
-- =====================================================================

create table if not exists public.offer_media (
  id              uuid primary key default gen_random_uuid(),
  offer_id        uuid not null references public.offers (id) on delete cascade,
  kind            text not null check (kind in ('image', 'video')),
  url             text not null,
  thumbnail_url   text,
  caption         text check (char_length(caption) <= 240),
  position        int not null default 0,
  created_at      timestamptz not null default now()
);

create index if not exists offer_media_offer_idx on public.offer_media (offer_id, position);

-- =====================================================================
-- MEMBERS (waitlist signups graduate into this once activated)
-- =====================================================================

create table if not exists public.members (
  id                uuid primary key default gen_random_uuid(),
  auth_user_id      uuid references auth.users (id) on delete set null,

  -- Identity
  first_name        text not null,
  last_name         text,
  credential        text,
  email             citext not null unique,
  phone             text,

  -- Practice
  practice_name     text,
  practice_role     text,
  city              text,

  -- Membership
  status            member_status not null default 'waitlist',
  tier              text default 'founding',
  joined_at         timestamptz,

  -- Tracking
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists members_status_idx        on public.members (status);
create index if not exists members_auth_user_id_idx  on public.members (auth_user_id);

-- =====================================================================
-- REDEMPTIONS (member used an offer)
-- =====================================================================

create table if not exists public.redemptions (
  id                    uuid primary key default gen_random_uuid(),
  offer_id              uuid not null references public.offers (id) on delete restrict,
  vendor_id             uuid not null references public.vendors (id) on delete restrict,
  member_id             uuid references public.members (id) on delete set null,

  -- Anonymized for vendor view
  member_display        text,   -- e.g. "Dr. Taylor"
  member_city           text,

  -- Money
  amount_saved          numeric(10, 2) check (amount_saved is null or amount_saved >= 0),
  commission_accrued    numeric(10, 2) check (commission_accrued is null or commission_accrued >= 0),

  -- Status
  status                redemption_status not null default 'confirmed',
  redeemed_on           date not null default current_date,

  notes                 text,
  created_at            timestamptz not null default now()
);

create index if not exists redemptions_offer_idx    on public.redemptions (offer_id);
create index if not exists redemptions_vendor_idx   on public.redemptions (vendor_id, redeemed_on desc);
create index if not exists redemptions_member_idx   on public.redemptions (member_id);

-- =====================================================================
-- ADMIN USERS (internal team)
-- =====================================================================

create table if not exists public.admin_users (
  id                uuid primary key default gen_random_uuid(),
  auth_user_id      uuid references auth.users (id) on delete set null,

  email             citext not null unique,
  full_name         text not null,
  role              admin_role not null default 'reviewer',

  active            boolean not null default true,
  last_active_at    timestamptz,

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists admin_users_email_idx        on public.admin_users (email);
create index if not exists admin_users_auth_user_id_idx on public.admin_users (auth_user_id);
create index if not exists admin_users_active_idx       on public.admin_users (active) where active = true;

-- Now that admin_users exists, add FKs from the review fields.
alter table public.vendor_applications
  drop constraint if exists vendor_applications_reviewed_by_fkey;
alter table public.vendor_applications
  add constraint vendor_applications_reviewed_by_fkey
  foreign key (reviewed_by) references public.admin_users (id) on delete set null;

alter table public.catalog_items
  drop constraint if exists catalog_items_reviewed_by_fkey;
alter table public.catalog_items
  add constraint catalog_items_reviewed_by_fkey
  foreign key (reviewed_by) references public.admin_users (id) on delete set null;

alter table public.offers
  drop constraint if exists offers_reviewed_by_fkey;
alter table public.offers
  add constraint offers_reviewed_by_fkey
  foreign key (reviewed_by) references public.admin_users (id) on delete set null;

-- =====================================================================
-- AUDIT LOGS (append-only, admin reads only)
-- =====================================================================

create table if not exists public.review_actions (
  id              uuid primary key default gen_random_uuid(),

  target_type     text not null check (target_type in ('vendor_application', 'catalog_item', 'offer', 'redemption', 'vendor', 'member')),
  target_id       uuid not null,
  action          text not null,  -- 'approved' | 'rejected' | 'needs_changes' | 'suspended' | etc.

  admin_id        uuid references public.admin_users (id) on delete set null,
  note            text,

  created_at      timestamptz not null default now()
);

create index if not exists review_actions_target_idx     on public.review_actions (target_type, target_id);
create index if not exists review_actions_admin_id_idx   on public.review_actions (admin_id);
create index if not exists review_actions_created_at_idx on public.review_actions (created_at desc);

create table if not exists public.auth_audit (
  id              uuid primary key default gen_random_uuid(),

  event           text not null,  -- 'magic_link_issued' | 'login_success' | 'login_failed' | ...
  email           citext,
  user_id         uuid,
  user_type       text check (user_type in ('vendor', 'member', 'admin')),

  ip_hash         text,
  user_agent      text,
  metadata        jsonb,

  created_at      timestamptz not null default now()
);

create index if not exists auth_audit_email_idx      on public.auth_audit (email);
create index if not exists auth_audit_event_idx      on public.auth_audit (event);
create index if not exists auth_audit_created_at_idx on public.auth_audit (created_at desc);

create table if not exists public.email_events (
  id                    uuid primary key default gen_random_uuid(),

  template              text not null,        -- 'magic_link' | 'application_received' | 'review_decision' | ...
  recipient             citext not null,
  subject               text,

  provider              text default 'resend',
  provider_message_id   text,

  status                text default 'sent',  -- 'sent' | 'delivered' | 'bounced' | 'complained' | 'opened' | 'clicked'
  delivered_at          timestamptz,
  opened_at             timestamptz,
  bounced_at            timestamptz,
  complained_at         timestamptz,

  metadata              jsonb,
  created_at            timestamptz not null default now()
);

create index if not exists email_events_recipient_idx on public.email_events (recipient);
create index if not exists email_events_template_idx  on public.email_events (template);
create index if not exists email_events_status_idx    on public.email_events (status);
create index if not exists email_events_created_at_idx on public.email_events (created_at desc);

-- =====================================================================
-- TRIGGERS
-- =====================================================================

-- Auto-update `updated_at` on row modification.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists vendors_updated_at on public.vendors;
create trigger vendors_updated_at before update on public.vendors
  for each row execute function public.set_updated_at();

drop trigger if exists vendor_applications_updated_at on public.vendor_applications;
create trigger vendor_applications_updated_at before update on public.vendor_applications
  for each row execute function public.set_updated_at();

drop trigger if exists catalog_items_updated_at on public.catalog_items;
create trigger catalog_items_updated_at before update on public.catalog_items
  for each row execute function public.set_updated_at();

drop trigger if exists offers_updated_at on public.offers;
create trigger offers_updated_at before update on public.offers
  for each row execute function public.set_updated_at();

drop trigger if exists members_updated_at on public.members;
create trigger members_updated_at before update on public.members
  for each row execute function public.set_updated_at();

drop trigger if exists admin_users_updated_at on public.admin_users;
create trigger admin_users_updated_at before update on public.admin_users
  for each row execute function public.set_updated_at();

-- Keep catalog_items.offer_count in sync when offers are added/removed.
create or replace function public.bump_catalog_offer_count()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    update public.catalog_items
       set offer_count = offer_count + 1
     where id = new.catalog_item_id;
    return new;
  elsif tg_op = 'DELETE' then
    update public.catalog_items
       set offer_count = greatest(offer_count - 1, 0)
     where id = old.catalog_item_id;
    return old;
  end if;
  return null;
end;
$$;

drop trigger if exists offers_count_trigger on public.offers;
create trigger offers_count_trigger
  after insert or delete on public.offers
  for each row execute function public.bump_catalog_offer_count();

-- Keep catalog_items.redemptions_lifetime in sync.
create or replace function public.bump_redemptions_lifetime()
returns trigger
language plpgsql
as $$
declare
  ci_id uuid;
begin
  if tg_op = 'INSERT' then
    select catalog_item_id into ci_id from public.offers where id = new.offer_id;
    if ci_id is not null then
      update public.catalog_items
         set redemptions_lifetime = redemptions_lifetime + 1
       where id = ci_id;
    end if;
    return new;
  elsif tg_op = 'DELETE' then
    select catalog_item_id into ci_id from public.offers where id = old.offer_id;
    if ci_id is not null then
      update public.catalog_items
         set redemptions_lifetime = greatest(redemptions_lifetime - 1, 0)
       where id = ci_id;
    end if;
    return old;
  end if;
  return null;
end;
$$;

drop trigger if exists redemptions_count_trigger on public.redemptions;
create trigger redemptions_count_trigger
  after insert or delete on public.redemptions
  for each row execute function public.bump_redemptions_lifetime();
