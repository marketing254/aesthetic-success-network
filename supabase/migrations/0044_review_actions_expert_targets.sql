-- =====================================================================
-- ASN — Allow expert audit rows in review_actions
-- Run after 0043_founding_expert_cap.sql.
--
-- BUG FIX. `review_actions.target_type` has carried the original 0002
-- CHECK list ever since:
--
--   ('vendor_application','catalog_item','offer','redemption','vendor','member')
--
-- but the expert console has been inserting `target_type =
-- 'expert_application'` for every start_review / decline / mark_onboarded
-- / admin_create since 0017. Those inserts violate the constraint and are
-- rejected — the calls are best-effort so nothing surfaced, and the whole
-- expert audit trail has been silently dropped. (Verified: review_actions
-- contained only 'vendor' rows.)
--
-- Adds the two expert target types:
--   'expert_application' — the application row (review workflow)
--   'expert'             — the provisioned experts row (e.g. granting the
--                          lifetime-free founding billing exemption)
-- =====================================================================

alter table public.review_actions
  drop constraint if exists review_actions_target_type_check;

alter table public.review_actions
  add constraint review_actions_target_type_check
  check (target_type in (
    'vendor_application',
    'catalog_item',
    'offer',
    'redemption',
    'vendor',
    'member',
    'expert_application',
    'expert'
  ));
