-- =====================================================================
-- 0029_resource_kind_book_club.sql
--
-- Adds the Book Club resource kinds to the `resource_kind` enum so the
-- bulk importer + admin upload can insert them without a check failure.
--
-- Values added:
--   book_study_guide      — replaces "Action Guide" on Book Club kits
--   discussion_questions  — Book Club discussion prompts (PDF)
--   infographic           — one-page visual summary (PDF)
--   infographic_image     — same content rendered as PNG
--   video_short           — 9x16 vertical short for a named principle
--
-- ALTER TYPE ... ADD VALUE must run OUTSIDE a transaction. Supabase
-- Studio's SQL Editor runs each statement individually, so this is fine
-- as written.
-- =====================================================================

alter type resource_kind add value if not exists 'book_study_guide';
alter type resource_kind add value if not exists 'discussion_questions';
alter type resource_kind add value if not exists 'infographic';
alter type resource_kind add value if not exists 'infographic_image';
alter type resource_kind add value if not exists 'video_short';

notify pgrst, 'reload schema';
