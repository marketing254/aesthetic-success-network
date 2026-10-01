-- =====================================================================
-- ASN — Expert Spotlight + Highlight Moment resource kinds
-- Run after 0044_review_actions_expert_targets.sql.
--
-- Newer kits (Callie Ward, Monica Watson, Jul 2026 onward) ship two video
-- types the importer had no rule for, so they were silently dropped:
--
--   Expert Spotlight - <topic>.mp4        — 16x9, ~2-4 min, the expert's
--                                           signature answer from the panel
--   Highlight N (16x9) - <moment>.mp4     — 16x9, ~1-2 min, one key moment
--
-- Both are LANDSCAPE (16x9), unlike `video_short` which is the 9x16
-- vertical format rendered in the portal's shorts rail. They must not be
-- mapped onto video_short or they'd be forced into the vertical player.
--
-- resource_kind is an enum, so the values have to exist before the
-- importer can insert them (same pattern as 0029).
-- =====================================================================

alter type resource_kind add value if not exists 'video_spotlight';
alter type resource_kind add value if not exists 'video_highlight';

notify pgrst, 'reload schema';
