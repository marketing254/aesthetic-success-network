-- =====================================================================
-- 0024_resource_inquiries.sql
--
-- Adds a public Q&A thread to each resource in the member library.
--
-- Why:
--   When an expert (or partner, once that lands) publishes a resource and
--   it shows up in the member library, members want a place to ask
--   follow-up questions. The expert/partner replies from their portal;
--   every member viewing that resource sees the whole thread.
--
-- Shape:
--   resources                                          (existing)
--      └─ resource_inquiries           (one row per member question)
--            └─ resource_inquiry_replies (one row per reply, any actor)
--
-- An "inquiry" is the top-level question. A "reply" is anything someone
-- says under it — members chiming in, the expert answering, an admin
-- clarifying. Replies show oldest-first inside an inquiry; inquiries
-- themselves list newest-first on the resource page.
--
-- Reply count is denormalised on the inquiry row + maintained by trigger
-- so listing pages don't have to count rows.
--
-- Notification routing happens in the API, not here — when an inquiry
-- (or reply) is created, the API looks up resources.originating_expert_id
-- and inserts a notifications row for that expert. We add the column
-- here so the link survives the resource-curation pipeline.
-- =====================================================================

-- 1. Track which expert authored the resource (for notification routing).
--    Nullable: admin-curated resources without an originating expert
--    just don't trigger expert notifications — admin gets them instead.
alter table public.resources
  add column if not exists originating_expert_id uuid
    references public.experts(id) on delete set null;

create index if not exists resources_originating_expert_idx
  on public.resources (originating_expert_id)
  where originating_expert_id is not null;

-- 2. Top-level inquiry from a member on a resource.
create table if not exists public.resource_inquiries (
  id                  uuid primary key default gen_random_uuid(),
  resource_id         uuid not null references public.resources(id) on delete cascade,
  -- Author identity captured at write time. We pin author_auth_user_id
  -- so the API can verify ownership for delete; the rest is denormalised
  -- so list queries don't need a join.
  author_auth_user_id uuid not null,
  author_member_id    uuid references public.members(id) on delete set null,
  author_display_name text not null,
  author_subtitle     text,
  body                text not null check (char_length(body) between 1 and 2000),
  -- Counter maintained by trigger.
  reply_count         integer not null default 0,
  status              text not null default 'open'
                      check (status in ('open', 'answered', 'closed')),
  -- Soft delete — keeps thread numbering stable when the author removes.
  hidden_at           timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists resource_inquiries_resource_idx
  on public.resource_inquiries (resource_id, created_at desc)
  where hidden_at is null;

create index if not exists resource_inquiries_author_idx
  on public.resource_inquiries (author_auth_user_id, created_at desc);

-- 3. Replies on an inquiry — can come from member, expert, partner, admin.
do $$
begin
  if not exists (select 1 from pg_type where typname = 'inquiry_reply_kind') then
    create type inquiry_reply_kind as enum ('member', 'expert', 'partner', 'admin');
  end if;
end$$;

create table if not exists public.resource_inquiry_replies (
  id                  uuid primary key default gen_random_uuid(),
  inquiry_id          uuid not null references public.resource_inquiries(id) on delete cascade,
  author_kind         inquiry_reply_kind not null,
  author_auth_user_id uuid not null,
  -- Role-specific row id (members.id / experts.id / vendors.id /
  -- admin_users.id), picked based on author_kind. Helpful for follow-up
  -- lookups; the denormalised name+subtitle below are what the UI renders.
  author_id           uuid,
  author_display_name text not null,
  author_subtitle     text,
  body                text not null check (char_length(body) between 1 and 4000),
  hidden_at           timestamptz,
  created_at          timestamptz not null default now()
);

create index if not exists resource_inquiry_replies_inquiry_idx
  on public.resource_inquiry_replies (inquiry_id, created_at asc)
  where hidden_at is null;

-- 4. Counter trigger — keeps resource_inquiries.reply_count in sync.
create or replace function bump_resource_inquiry_reply_count() returns trigger as $$
begin
  if tg_op = 'INSERT' and new.hidden_at is null then
    update public.resource_inquiries
      set reply_count = reply_count + 1,
          updated_at = now(),
          status = case
            -- An expert reply on an open inquiry flips it to 'answered'.
            when new.author_kind = 'expert' and resource_inquiries.status = 'open'
              then 'answered'
            else resource_inquiries.status
          end
      where id = new.inquiry_id;
  elsif tg_op = 'UPDATE' then
    -- Soft-delete: hidden_at moved from null → not null.
    if old.hidden_at is null and new.hidden_at is not null then
      update public.resource_inquiries
        set reply_count = greatest(reply_count - 1, 0),
            updated_at = now()
        where id = new.inquiry_id;
    -- Un-delete: hidden_at moved from not null → null.
    elsif old.hidden_at is not null and new.hidden_at is null then
      update public.resource_inquiries
        set reply_count = reply_count + 1,
            updated_at = now()
        where id = new.inquiry_id;
    end if;
  elsif tg_op = 'DELETE' and old.hidden_at is null then
    update public.resource_inquiries
      set reply_count = greatest(reply_count - 1, 0),
          updated_at = now()
      where id = old.inquiry_id;
  end if;
  return coalesce(new, old);
end$$ language plpgsql;

drop trigger if exists trg_resource_inquiry_reply_count on public.resource_inquiry_replies;
create trigger trg_resource_inquiry_reply_count
after insert or update or delete on public.resource_inquiry_replies
for each row execute function bump_resource_inquiry_reply_count();

-- 5. updated_at trigger on inquiries
create or replace function touch_resource_inquiry_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end$$ language plpgsql;

drop trigger if exists trg_touch_resource_inquiry_updated on public.resource_inquiries;
create trigger trg_touch_resource_inquiry_updated
before update on public.resource_inquiries
for each row execute function touch_resource_inquiry_updated_at();

-- 6. Row-Level Security
-- ------------------------------------------------------------------------
-- Reads: any authenticated network participant (member / expert / partner
--        / admin) can read inquiries + replies that are not hidden. This
--        matches the user's requirement that "other members accessing
--        resources can see the comments below".
-- Writes: API uses service role and verifies identity server-side via
--         the cookie-bound client, so we don't open writes to anon here.
-- ------------------------------------------------------------------------
alter table public.resource_inquiries enable row level security;
alter table public.resource_inquiry_replies enable row level security;

drop policy if exists resource_inquiries_visible_to_network on public.resource_inquiries;
create policy resource_inquiries_visible_to_network on public.resource_inquiries
  for select
  to authenticated
  using (hidden_at is null);

drop policy if exists resource_inquiry_replies_visible_to_network on public.resource_inquiry_replies;
create policy resource_inquiry_replies_visible_to_network on public.resource_inquiry_replies
  for select
  to authenticated
  using (hidden_at is null);

grant select on public.resource_inquiries to authenticated;
grant select on public.resource_inquiry_replies to authenticated;

-- 7. Realtime — push inserts/updates/deletes to the browser channel so
--    threads update without refresh.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'resource_inquiries'
  ) then
    alter publication supabase_realtime add table public.resource_inquiries;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'resource_inquiry_replies'
  ) then
    alter publication supabase_realtime add table public.resource_inquiry_replies;
  end if;
end $$;

notify pgrst, 'reload schema';
