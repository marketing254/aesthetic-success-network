-- =====================================================================
-- ASN — Multi-company partners (one partner, several companies).
-- Run after 0039.
--
-- Price is charged per PARTNER, not per company. A partner (e.g. Dr.
-- Phelps) can own several company listings; the paying/principal vendor
-- row carries the card + subscription + agreement, and the extra company
-- rows point at it via billing_parent_id. Covered companies never bill on
-- their own — their portal access + directory visibility inherit the
-- parent's subscription.
--
-- Fully additive: single-company partners leave billing_parent_id NULL and
-- run the exact same code paths as before.
-- =====================================================================

alter table public.vendors
  add column if not exists billing_parent_id uuid
    references public.vendors(id) on delete set null;

create index if not exists vendors_billing_parent_idx
  on public.vendors (billing_parent_id);
