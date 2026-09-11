-- ============================================================
-- ASN member portal · 0025 — Saved items (bookmarks)
--
-- Lets a member bookmark an expert or partner from the member-portal
-- directories. One small polymorphic table rather than two near-
-- identical ones — item_type + item_id points at expert_applications
-- or partner_applications depending on the type.
-- ============================================================

create table if not exists public.saved_items (
  id         uuid primary key default gen_random_uuid(),
  member_id  uuid not null references public.members(id) on delete cascade,
  item_type  text not null check (item_type in ('expert','partner')),
  item_id    uuid not null,
  created_at timestamptz not null default now()
);

create unique index if not exists saved_items_unique
  on public.saved_items (member_id, item_type, item_id);
create index if not exists saved_items_member_idx
  on public.saved_items (member_id, created_at desc);

alter table public.saved_items enable row level security;
