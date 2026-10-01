-- =====================================================================
-- ASN — Kit access counts (dashboard "Top 5")
-- Run after 0052_billing_hardening.sql.
--
-- Aggregates member_resource_progress into per-kit open counts so the
-- member dashboard's "Top 5 in the network" ranks by real usage without
-- the API scanning the whole progress table on every page load.
-- Exposes aggregate numbers only — no member ids.
-- =====================================================================

create or replace view public.kit_access_counts as
select
  r.topic_slug as slug,
  count(*)::bigint as views
from public.member_resource_progress p
join public.resources r on r.id = p.resource_id
where r.is_published = true
  and r.submission_status = 'approved'
group by r.topic_slug;

comment on view public.kit_access_counts is
  'Per-kit resource-open counts across all members. Read by GET /api/member/top-kits (service role only).';

-- Service-role only: the guarded member API is the sole reader, so no
-- browser role should be able to query it directly.
revoke all on public.kit_access_counts from anon, authenticated;
