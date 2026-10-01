-- =====================================================================
-- ASN — Job board: pay range and description become optional for
--       BANNER posts only. Detailed posts are unaffected.
-- Run AFTER 0063_job_applications.sql.
-- Paste into Supabase Dashboard → SQL Editor → New query → Run.
--
-- THIS REVERSES PART OF 0060 ON PURPOSE, AT THE MEMBER'S EXPLICIT
-- REQUEST, KNOWING THE TRADEOFF:
--
--   0060 made pay_min/pay_max/description NOT NULL for both post
--   formats specifically so a banner-only post would still carry
--   indexable text for Google, the JobPosting structured data, and
--   screen readers — see the comment block above its `job_post_format`
--   section. That reasoning has not changed and still applies in full
--   to DETAILED posts, which keep the original NOT NULL requirement.
--
--   For BANNER posts, the product decision is now that the graphic
--   itself carries this content (in the style of a topjobs-style
--   poster), and typing it a second time into the form is friction the
--   member shouldn't have to pay. The accepted cost: a banner post
--   left blank here has no baseSalary in its structured data and a
--   synthesized (not member-written) description, so it is weaker for
--   Google for Jobs and for screen reader users than one where the
--   member filled it in. See src/lib/jobs/jsonLd.ts and
--   src/lib/jobs/format.ts for how the app fills the resulting gaps.
-- =====================================================================

alter table public.job_posts
  alter column pay_min drop not null,
  alter column pay_max drop not null,
  alter column description drop not null;

-- The individual column CHECK constraints from 0058 (pay_min >= 0,
-- pay_max >= 0, char_length(description) between 30 and 8000) and the
-- job_posts_pay_range check (pay_max >= pay_min) all evaluate to NULL —
-- which CHECK treats as satisfied — when the value itself is NULL, so
-- none of them need to change. Only a new constraint is needed to keep
-- DETAILED posts exactly as strict as before.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'job_posts_detailed_needs_pay_and_description'
  ) then
    alter table public.job_posts
      add constraint job_posts_detailed_needs_pay_and_description
      check (
        post_format = 'banner'
        or (pay_min is not null and pay_max is not null and description is not null)
      );
  end if;
end$$;
