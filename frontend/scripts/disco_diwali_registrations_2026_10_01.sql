-- ============================================================================
-- Disco Diwali: registrations + settings, for the TerraThon admin desk
--
-- NOT YET APPLIED. Paste into the SQL editor of the COMMUNITY Supabase project
-- (TerraThon reads and writes through supabaseCommunity, not the Paradox
-- project). Verify against the live schema afterwards: a .sql file existing in
-- this repo is not evidence it ran (CLAUDE.md, "Verify the live schema").
--
-- WHAT THIS IS
--
-- A port of Paradox's After Party desk (paradox_afterparty_registrations) to
-- the TerraThon admin at /terrathon/admin/disco-diwali. Admins log confirmed
-- tickets by hand as WhatsApp / in-person payments arrive, copy a thank-you
-- message, and tick people in at the door. There is no public form and no
-- public read.
--
-- TWO TABLES
--
--   disco_diwali_registrations   one row per ticket. dd_id is the short
--                                human ID ("DD26-K3X7") the door reads.
--   disco_diwali_settings        key/value. Holds the editable phase list
--                                (prices, open dates, closed flag) and the two
--                                thank-you templates, so every admin sees the
--                                same ones. The Paradox desk keeps these in
--                                paradox_site_settings, which does not exist
--                                in this project.
--
-- `phase` is deliberately free text constrained by FORMAT, not by a list of
-- keys. Paradox shipped with a CHECK locked to four keys and then needed a
-- second migration (paradox_afterparty_phase_open_constraint.sql) the first
-- time an admin pressed "+ Add phase". Start open.
--
-- SECURITY
--
-- Every policy is `is_director() or is_super_admin()`, the same gate as every
-- terrathon_* table. That is the boundary: the sign-in panel is convenience.
-- Rows hold names and phone numbers, so anon gets nothing at all, not even a
-- policy that returns zero rows. Grants are revoked from anon and PUBLIC
-- explicitly because a new table in `public` is granted to anon by default.
-- ============================================================================

create table if not exists public.disco_diwali_registrations (
  id          uuid        primary key default gen_random_uuid(),
  dd_id       text        not null unique,
  name        text        not null check (length(btrim(name)) between 1 and 120),
  phone       text        not null check (length(btrim(phone)) between 5 and 20),
  school      text,
  phase       text        not null default 'phase_1' check (phase ~ '^[a-z0-9_]+$'),
  amount      integer     check (amount is null or amount >= 0),
  paid        boolean     not null default true,
  attended    boolean     not null default false,
  notes       text,
  created_by  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.disco_diwali_registrations is
  'Manually logged Disco Diwali tickets. Admins add rows in /terrathon/admin/disco-diwali as confirmations come in.';
comment on column public.disco_diwali_registrations.dd_id is
  'Short ID the door reads, e.g. DD26-K3X7. Generated client-side, uniqueness enforced here; the client retries on 23505.';

create index if not exists idx_disco_diwali_created_at
  on public.disco_diwali_registrations (created_at desc);

create table if not exists public.disco_diwali_settings (
  key         text        primary key check (key ~ '^[a-z0-9_]+$'),
  value       jsonb       not null,
  updated_at  timestamptz not null default now()
);

comment on table public.disco_diwali_settings is
  'Editable Disco Diwali desk config: dd_phases (list), dd_thankyou_msg and dd_thankyou_multi (strings).';

-- updated_at, so an audit of "who touched this last" stays honest
create or replace function public.disco_diwali_touch_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_disco_diwali_reg_touch on public.disco_diwali_registrations;
create trigger trg_disco_diwali_reg_touch
  before update on public.disco_diwali_registrations
  for each row execute function public.disco_diwali_touch_updated_at();

drop trigger if exists trg_disco_diwali_settings_touch on public.disco_diwali_settings;
create trigger trg_disco_diwali_settings_touch
  before update on public.disco_diwali_settings
  for each row execute function public.disco_diwali_touch_updated_at();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.disco_diwali_registrations enable row level security;
alter table public.disco_diwali_settings      enable row level security;

drop policy if exists dd_reg_leader_all on public.disco_diwali_registrations;
create policy dd_reg_leader_all on public.disco_diwali_registrations
  for all to authenticated
  using (is_director() or is_super_admin())
  with check (is_director() or is_super_admin());

drop policy if exists dd_settings_leader_all on public.disco_diwali_settings;
create policy dd_settings_leader_all on public.disco_diwali_settings
  for all to authenticated
  using (is_director() or is_super_admin())
  with check (is_director() or is_super_admin());

revoke all on public.disco_diwali_registrations from public, anon;
revoke all on public.disco_diwali_settings      from public, anon;
grant select, insert, update, delete on public.disco_diwali_registrations to authenticated;
grant select, insert, update, delete on public.disco_diwali_settings      to authenticated;

-- ---------------------------------------------------------------------------
-- Verify. Expect: 2 tables with rls on, 2 policies on {authenticated} with
-- qual (is_director() OR is_super_admin()), and zero anon privileges.
-- ---------------------------------------------------------------------------
select relname, relrowsecurity
  from pg_class
 where oid in ('public.disco_diwali_registrations'::regclass, 'public.disco_diwali_settings'::regclass);

select tablename, policyname, roles, cmd, qual
  from pg_policies
 where tablename in ('disco_diwali_registrations', 'disco_diwali_settings');

select grantee, table_name, privilege_type
  from information_schema.role_table_grants
 where table_schema = 'public'
   and table_name in ('disco_diwali_registrations', 'disco_diwali_settings')
   and grantee in ('anon', 'public');   -- expect no rows
