-- ============================================================================
-- AquaTerra.live: the enquiries inbox
--
-- APPLIED 2026-10-24 to the community project (hzowuwffjqtgszecngpe) as migration `live_enquiries_inbox`.
-- Verified live by role: anon can insert a well-formed row, cannot read, cannot insert handled = true, and a bad topic is refused by
-- the CHECK; the test rows were rolled back and the table is empty. To verify again:
--   select policyname, cmd from pg_policies where tablename = 'live_enquiries';
--   -- expect: insert for anon+authenticated, select and update for leaders only
--
-- The contact form on /live/contact writes here; leaders read and tick them off
-- at /live/admin/enquiries. Without this table the form tells the visitor so and
-- offers WhatsApp instead, so nothing is lost while it is unapplied.
--
-- WHO CAN DO WHAT
--   insert  anyone, including signed-out visitors, but only a well-formed row
--           (lengths and the topic list are enforced by CHECKs, so a script cannot
--           stuff the table with megabytes or invent topics)
--   select  is_director() or is_super_admin() only: contacts are personal data
--   update  the same, and only the `handled` flag is meant to change
--   delete  nobody from the app
-- ============================================================================

create table if not exists public.live_enquiries (
  id          uuid        primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  name        text        not null check (length(btrim(name)) between 1 and 80),
  contact     text        not null check (length(btrim(contact)) between 5 and 120),
  topic       text        not null check (topic in ('tickets','sponsor','stall','performer','press','photo','other')),
  message     text        not null check (length(btrim(message)) between 10 and 1000),
  handled     boolean     not null default false
);

comment on table public.live_enquiries is
  'Messages from the AquaTerra.live contact form. Personal data: leaders only.';

create index if not exists idx_live_enquiries_created on public.live_enquiries (created_at desc);

alter table public.live_enquiries enable row level security;

-- a new table in public is granted to anon by default; say exactly what is allowed
revoke all on public.live_enquiries from anon, authenticated, public;
grant insert on public.live_enquiries to anon, authenticated;
grant select, update (handled) on public.live_enquiries to authenticated;

create policy live_enquiries_insert on public.live_enquiries
  for insert to anon, authenticated
  with check (handled = false);

create policy live_enquiries_read on public.live_enquiries
  for select to authenticated
  using (public.is_director() or public.is_super_admin());

create policy live_enquiries_update on public.live_enquiries
  for update to authenticated
  using (public.is_director() or public.is_super_admin())
  with check (public.is_director() or public.is_super_admin());
