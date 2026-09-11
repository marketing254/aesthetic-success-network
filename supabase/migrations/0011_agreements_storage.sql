-- ============================================================
-- ASN billing phase · 0011 — private storage bucket for signed
-- membership/expert/partner agreement PDFs.
--
-- Private (not public) — nobody reads this bucket directly. Every
-- access goes through the service-role client: uploads happen inline
-- in the trial-start routes, and downloads (if ever needed) would go
-- through a signed URL minted by an authenticated API route. No
-- `storage.objects` RLS policy is needed because there is no
-- client-side access path to defend.
-- ============================================================

insert into storage.buckets (id, name, public)
values ('agreements', 'agreements', false)
on conflict (id) do nothing;
