-- =====================================================================
-- ASN — Spotlights can belong to an expert AND a partner (Phase: Pearl+)
-- Run after 0049_inquiry_pack_delivery.sql.
--
-- When an expert and a partner company are related (e.g. an expert who
-- teaches under a partner brand), one spotlight should surface on BOTH
-- profiles. Relax the one-owner XOR to "one or two owners". The feed
-- nudge still credits a single author (expert preferred) because
-- expert_posts keeps its exactly-one-author constraint.
-- =====================================================================

alter table public.profile_spotlights
  drop constraint if exists spotlight_one_owner;

alter table public.profile_spotlights
  add constraint spotlight_owner_present
  check (num_nonnulls(expert_id, vendor_id) between 1 and 2);

notify pgrst, 'reload schema';
