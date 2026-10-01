-- =====================================================================
-- ASN - Founding agreement v4 for personalized invite flow.
-- Run after 0038_application_extra_fields.sql.
--
-- The approved personalized founding templates are v4 (July 2026).
-- Existing unaccepted drafts/sent invites should be regenerated from v4
-- when an admin clicks Send invite. Accepted records keep their original
-- version label as an audit record.
-- =====================================================================

alter table public.founding_invites
  alter column agreement_version set default 'v4';

update public.founding_invites
set agreement_version = 'v4',
    updated_at = now()
where status in ('draft', 'sent', 'viewed')
  and agreement_version <> 'v4';
