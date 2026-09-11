-- ============================================================
-- ASN content phase · 0012 — public blog posts + member reviews
--
-- Backs the public /blog, /blog/[slug] and /reviews pages. Both
-- tables are read by public marketing pages via the service-role
-- client (same pattern as /api/directory/*): no anon-key access,
-- no public RLS policies needed.
--
-- Seed rows below are clearly-marked placeholder content, themed for
-- aesthetic practices, meant to be replaced with real posts/reviews
-- once the team has them — scaffolding, not final copy.
-- ============================================================

create table if not exists public.blog_posts (
  id             uuid primary key default gen_random_uuid(),
  slug           text not null,
  title          text not null,
  excerpt        text not null,
  body           text not null,            -- plain paragraphs, split on blank lines
  cover_image_url text,
  author_name    text not null default 'Aesthetic Success Network',
  category       text,
  tags           text[] not null default '{}',
  status         text not null default 'draft'
                 check (status in ('draft','published','archived')),
  published_at   timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create unique index if not exists blog_posts_slug_uidx
  on public.blog_posts (slug);
create index if not exists blog_posts_status_idx
  on public.blog_posts (status, published_at desc);

alter table public.blog_posts enable row level security;

create table if not exists public.member_reviews (
  id             uuid primary key default gen_random_uuid(),
  author_name    text not null,
  practice_name  text,
  role           text,               -- e.g. "Owner", "Medical Director"
  quote          text not null,
  rating         smallint not null default 5 check (rating between 1 and 5),
  avatar_url     text,
  featured       boolean not null default false,
  status         text not null default 'draft'
                 check (status in ('draft','published','archived')),
  published_at   timestamptz,
  created_at     timestamptz not null default now()
);

create index if not exists member_reviews_status_idx
  on public.member_reviews (status, published_at desc);

alter table public.member_reviews enable row level security;

-- ── Placeholder seed content (scaffolding — swap for real copy) ────────
insert into public.blog_posts (slug, title, excerpt, body, author_name, category, tags, status, published_at)
values
(
  'pricing-injectables-without-losing-margin',
  'Pricing injectables without losing your margin',
  'A simple framework for setting (and holding) injectable pricing when product costs keep creeping up.',
  E'Most practices price injectables once, at launch, and never revisit it. Eighteen months later, product costs have crept up 12-15% and the margin has quietly disappeared.\n\nStart with your true cost per unit, not the invoice sticker price. Freight, waste, and the syringe/needle kit all belong in that number.\n\nThen set a minimum margin floor per treatment category and review it quarterly, not annually. A quarterly five-minute check catches drift before it compounds into a real problem.\n\nFinally, separate your "everyday" price from your promotional price. A blanket 20%-off event on top of an already-thin margin is how practices quietly lose money while feeling busy.\n\nThis is placeholder scaffolding content for the Aesthetic Success Network blog. Swap in a real, reviewed article before publishing.',
  'Aesthetic Success Network',
  'Pricing & Margins',
  array['pricing','injectables','margin'],
  'published',
  now() - interval '18 days'
),
(
  'hiring-and-keeping-a-great-injector',
  'Hiring (and keeping) a great injector',
  'What actually predicts retention in an injector hire, beyond years of experience and a good portfolio.',
  E'A strong portfolio gets an injector in the interview room. It does not predict whether they stay two years or two months.\n\nThe strongest predictor we see across member practices is a structured first-90-days plan: a clear production ramp, a named mentor, and a defined path to their own book of patients.\n\nCompensation structure matters more than the headline number. A blended base-plus-production model that pays out weekly beats a pure-commission model for retention, even when the pure-commission ceiling is higher.\n\nThis is placeholder scaffolding content for the Aesthetic Success Network blog. Swap in a real, reviewed article before publishing.',
  'Aesthetic Success Network',
  'Staffing',
  array['hiring','staffing','injectors'],
  'published',
  now() - interval '9 days'
),
(
  'the-consult-that-converts-without-pressure',
  'The consult that converts, without the pressure',
  'A consult structure that raises close rates while making patients feel informed, not sold to.',
  E'The highest-converting consults we see are not the most persuasive. They are the most structured.\n\nOpen with the patient''s stated goal in their own words, written down, and refer back to it at every decision point in the consult. It keeps the conversation anchored to their outcome, not your treatment menu.\n\nPresent a maximum of three options, ranked by fit to the stated goal, not by price. Overwhelm is the single biggest silent killer of same-day conversion.\n\nThis is placeholder scaffolding content for the Aesthetic Success Network blog. Swap in a real, reviewed article before publishing.',
  'Aesthetic Success Network',
  'Sales & Conversion',
  array['consults','conversion','patient experience'],
  'published',
  now() - interval '3 days'
),
(
  'reading-your-practice-numbers-in-20-minutes-a-week',
  'Reading your practice numbers in 20 minutes a week',
  'The four numbers worth checking weekly, and why most owners are tracking the wrong ones.',
  E'Most practice owners either check numbers daily (too much noise) or monthly (too late to act). Weekly is the sweet spot for the four numbers that actually move the needle.\n\nTrack new-patient count, same-day conversion rate, average ticket, and injector utilization. Everything else is a monthly or quarterly conversation.\n\nThis is placeholder scaffolding content for the Aesthetic Success Network blog. Swap in a real, reviewed article before publishing.',
  'Aesthetic Success Network',
  'Operations',
  array['kpis','operations','reporting'],
  'draft',
  null
)
on conflict (slug) do nothing;

insert into public.member_reviews (author_name, practice_name, role, quote, rating, featured, status, published_at)
values
(
  'Dr. Amara Chen',
  'Willow & Vine Aesthetics',
  'Owner, Medical Director',
  'Placeholder review — swap for a real member quote. I called the Hotline about a pricing problem I''d been guessing at for a year. Three days later I had a written plan and three vendor intros. That alone paid for the membership.',
  5,
  true,
  'published',
  now() - interval '30 days'
),
(
  'Marisol Reyes',
  'Bloom Med Spa',
  'Owner',
  'Placeholder review — swap for a real member quote. The vendor deals paid for the membership in the first month. Everything else is a bonus at this point.',
  5,
  true,
  'published',
  now() - interval '21 days'
),
(
  'Dr. Trevor Aldous',
  'Aldous Dermatology',
  'Owner',
  'Placeholder review — swap for a real member quote. I was skeptical of another "network," but there''s no upsell behind the door. It''s just the Hotline, the kits and the deals, exactly as advertised.',
  4,
  false,
  'published',
  now() - interval '14 days'
),
(
  'Priya Nair',
  'Nair Skin Studio',
  'Owner, Esthetician',
  'Placeholder review — swap for a real member quote. New expert kits land almost every week. My front desk uses the consult scripts as-is.',
  5,
  false,
  'published',
  now() - interval '6 days'
)
on conflict do nothing;
