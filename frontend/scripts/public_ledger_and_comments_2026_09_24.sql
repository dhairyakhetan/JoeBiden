-- Open Books (/accounts) — public_ledger + ledger_comments
-- ────────────────────────────────────────────────────────────────────────────
-- APPLIED LIVE 2026-09-24 against the community project (hzowuwffjqtgszecngpe),
-- via the Supabase MCP connector, in the session that built this migration.
-- This file is a RECORD of what ran, not a pending change — re-running the
-- CREATE TABLE statements will fail because the tables already exist.
-- Verified live (see the checks at the bottom of this file, all re-run after
-- applying): 149 rows in public_ledger matching the PRD §3.4 fixtures exactly,
-- RLS policies present, and the insert-without-select behaviour on
-- ledger_comments confirmed with `set local role anon`.
--
-- Two tables:
--   public_ledger    — the FY2026-27 transaction ledger rendered at /accounts.
--                       Publicly readable (anon + authenticated), writable
--                       only by directors/super admins. A clean table-level
--                       grant — this is NOT `members`, so the column-level
--                       PII lockdown discipline elsewhere in this repo does
--                       not apply here; there is no PII in this table.
--   ledger_comments   — write-only-to-the-public "suggest a saving" comments
--                       on an expense line. Anyone (anon or authenticated) can
--                       INSERT; only directors/super admins can SELECT/UPDATE.
--                       No SELECT grant for anon/authenticated at all, which
--                       is the entire point — verified below.
--
-- ── A trap this migration hit, worth keeping for the next person who touches
--    a table in this project ───────────────────────────────────────────────
-- Supabase's project-wide default ACL (`pg_default_acl`, defaclrole=postgres)
-- grants anon AND authenticated FULL privileges (arwdDxtm — select, insert,
-- update, delete, ...) on every NEW table created by the postgres role,
-- BEFORE any explicit GRANT in a migration runs. The first version of this
-- migration only ADDED grants on top of that baseline, so anon silently kept
-- table-level INSERT/UPDATE/DELETE on public_ledger and SELECT/UPDATE/DELETE
-- on ledger_comments — RLS still blocked every one of those (no matching
-- policy for anon on those commands on either table, confirmed live), but the
-- raw grant sat there unlike this file's own stated intent, and unlike the
-- older welfare_projects table (whose anon grants are SELECT-only, apparently
-- cleaned up by whoever created it). Fixed here with an explicit
-- REVOKE ALL ... FROM anon, authenticated before the intended GRANTs, in one
-- transaction — the same REVOKE-then-GRANT discipline CLAUDE.md documents for
-- `members`. If you create a new public-facing table in this project, check
-- `information_schema.role_table_grants` after — don't assume an unqualified
-- `grant select ...` leaves everything else ungranted.

create table public.public_ledger (
  id          bigint generated always as identity primary key,
  date        date        not null,
  category    text        not null,
  amount      numeric(12,2) not null check (amount > 0),
  flow        text        not null check (flow in ('in','out')),
  source      text        not null check (source in ('Bank','Cash')),
  attribution text        not null,
  fy          text        not null default '2026-27'
);

alter table public.public_ledger enable row level security;

create policy "public_ledger readable by anyone"
  on public.public_ledger for select
  to anon, authenticated using (true);

create policy "public_ledger writable by leaders"
  on public.public_ledger for all
  to authenticated using (is_director() or is_super_admin())
  with check (is_director() or is_super_admin());

create table public.ledger_comments (
  id         bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  category   text        not null,
  body       text        not null check (char_length(body) between 1 and 2000),
  fy         text        not null default '2026-27',
  handled_at timestamptz,
  handled_by uuid
);

alter table public.ledger_comments enable row level security;

-- anyone, signed in or not, may leave one
create policy "ledger_comments insertable by anyone"
  on public.ledger_comments for insert
  to anon, authenticated with check (true);

-- only leaders may read them
create policy "ledger_comments readable by leaders"
  on public.ledger_comments for select
  to authenticated using (is_director() or is_super_admin());

create policy "ledger_comments updatable by leaders"
  on public.ledger_comments for update
  to authenticated using (is_director() or is_super_admin())
  with check (is_director() or is_super_admin());

-- Reset both tables' grants to exactly this file's intent (see the trap note
-- above) in one transaction, then grant precisely what's needed.
begin;
  revoke all on public.public_ledger from anon, authenticated;
  grant select on public.public_ledger to anon, authenticated;
  grant insert, update, delete on public.public_ledger to authenticated;

  revoke all on public.ledger_comments from anon, authenticated;
  grant insert on public.ledger_comments to anon, authenticated;
  grant select, update on public.ledger_comments to authenticated;
commit;

-- ── Seed: the FY2026-27 ledger, 149 rows, verbatim from the approved
--    reference (accounts-reference.html's TX array). CRFTD is already netted
--    (one "Contribution from CRFTD" row, not its gross sales/costs) — see
--    PRD §3.1.
insert into public.public_ledger (date, category, amount, flow, source, attribution) values
  ('2026-04-02', 'Venue and decor', 5000, 'out', 'Bank', 'Terrathon'),
  ('2026-04-02', 'Event ticket sales', 275, 'in', 'Bank', 'Terrathon'),
  ('2026-04-03', 'Technology', 283.83, 'out', 'Bank', 'Organisation'),
  ('2026-04-04', 'Refunds issued to participants', 274, 'out', 'Bank', 'Terrathon'),
  ('2026-04-04', 'Event ticket sales', 12150, 'in', 'Bank', 'Terrathon'),
  ('2026-04-05', 'Event ticket sales', 8774, 'in', 'Bank', 'Terrathon'),
  ('2026-04-06', 'Stationery and small furniture', 208, 'out', 'Bank', 'Organisation'),
  ('2026-04-06', 'Stationery and small furniture', 482, 'out', 'Bank', 'Organisation'),
  ('2026-04-06', 'Event ticket sales', 15001, 'in', 'Bank', 'Terrathon'),
  ('2026-04-07', 'Refunds issued to participants', 1500, 'out', 'Bank', 'Terrathon'),
  ('2026-04-07', 'Event ticket sales', 8283.83, 'in', 'Bank', 'Terrathon'),
  ('2026-04-09', 'Technology', 1999, 'out', 'Bank', 'Organisation'),
  ('2026-04-10', 'Welfare, volunteer and on-ground logistics', 100, 'out', 'Bank', 'Welfare'),
  ('2026-04-10', 'Prizes and participant costs', 1600, 'out', 'Bank', 'Terrathon'),
  ('2026-04-11', 'Prizes and participant costs', 3600, 'out', 'Bank', 'Terrathon'),
  ('2026-04-11', 'Prizes and participant costs', 7000, 'out', 'Bank', 'Terrathon'),
  ('2026-04-11', 'Prizes and participant costs', 1500, 'out', 'Bank', 'Terrathon'),
  ('2026-04-12', 'Refunds issued to participants', 1965, 'out', 'Cash', 'Terrathon'),
  ('2026-04-12', 'Prizes and participant costs', 2000, 'out', 'Bank', 'Terrathon'),
  ('2026-04-12', 'Prizes and participant costs', 1500, 'out', 'Bank', 'Terrathon'),
  ('2026-04-12', 'Welfare, volunteer and on-ground logistics', 5060, 'out', 'Cash', 'Welfare'),
  ('2026-04-12', 'Refunds issued to participants', 4110, 'out', 'Cash', 'Terrathon'),
  ('2026-04-12', 'Venue and decor', 11992, 'out', 'Bank', 'Terrathon'),
  ('2026-04-13', 'Technology', 2189.48, 'out', 'Bank', 'Organisation'),
  ('2026-04-13', 'Refunds issued to participants', 750, 'out', 'Bank', 'Terrathon'),
  ('2026-04-13', 'Prizes and participant costs', 750, 'out', 'Bank', 'Terrathon'),
  ('2026-04-13', 'Venue and decor', 2995, 'out', 'Bank', 'Terrathon'),
  ('2026-04-15', 'Refunds issued to participants', 750, 'out', 'Bank', 'Terrathon'),
  ('2026-04-15', 'Prizes and participant costs', 4500, 'out', 'Bank', 'Terrathon'),
  ('2026-04-15', 'Prizes and participant costs', 3500, 'out', 'Bank', 'Terrathon'),
  ('2026-04-15', 'Prizes and participant costs', 2500, 'out', 'Bank', 'Terrathon'),
  ('2026-04-15', 'Refunds issued to participants', 530, 'out', 'Bank', 'Terrathon'),
  ('2026-04-18', 'Refunds issued to participants', 300, 'out', 'Cash', 'Terrathon'),
  ('2026-04-19', 'Technology', 843.7, 'out', 'Bank', 'Organisation'),
  ('2026-04-22', 'Refunds issued to participants', 3500, 'out', 'Cash', 'Terrathon'),
  ('2026-04-25', 'Stationery and small furniture', 503.25, 'out', 'Bank', 'Organisation'),
  ('2026-04-28', 'Bank fees', 90.44, 'out', 'Bank', 'Organisation'),
  ('2026-04-30', 'Stationery and small furniture', 262.21, 'out', 'Bank', 'Organisation'),
  ('2026-05-01', 'Bank fees', 9.96, 'out', 'Bank', 'Organisation'),
  ('2026-05-09', 'Refunds issued to participants', 10000, 'out', 'Bank', 'Paradox'),
  ('2026-05-12', 'Stationery and small furniture', 306, 'out', 'Bank', 'Organisation'),
  ('2026-05-12', 'Stationery and small furniture', 254, 'out', 'Bank', 'Organisation'),
  ('2026-05-14', 'Stationery and small furniture', 1703, 'out', 'Bank', 'Organisation'),
  ('2026-05-14', 'Welfare, volunteer and on-ground logistics', 9000, 'out', 'Cash', 'Welfare'),
  ('2026-05-18', 'Refunds issued to participants', 8198, 'out', 'Bank', 'Paradox'),
  ('2026-05-18', 'Stationery and small furniture', 2755, 'out', 'Bank', 'Organisation'),
  ('2026-05-19', 'Event ticket sales', 13651, 'in', 'Bank', 'Paradox'),
  ('2026-05-19', 'Welfare, volunteer and on-ground logistics', 5000, 'out', 'Bank', 'Welfare'),
  ('2026-05-20', 'Event ticket sales', 9418, 'in', 'Bank', 'Paradox'),
  ('2026-05-20', 'Refunds issued to participants', 275, 'out', 'Bank', 'Paradox'),
  ('2026-05-21', 'Technology', 713.65, 'out', 'Bank', 'Organisation'),
  ('2026-05-21', 'Event ticket sales', 15360, 'in', 'Bank', 'Paradox'),
  ('2026-05-22', 'Refunds issued to participants', 350, 'out', 'Bank', 'Paradox'),
  ('2026-05-22', 'Event ticket sales', 30500, 'in', 'Bank', 'Paradox'),
  ('2026-05-23', 'Event ticket sales', 31600, 'in', 'Bank', 'Paradox'),
  ('2026-05-24', 'Bank fees', 15.58, 'out', 'Bank', 'Organisation'),
  ('2026-05-24', 'Refunds issued to participants', 450, 'out', 'Bank', 'Paradox'),
  ('2026-05-24', 'Event ticket sales', 24750, 'in', 'Bank', 'Paradox'),
  ('2026-05-25', 'Welfare, volunteer and on-ground logistics', 80, 'out', 'Bank', 'Welfare'),
  ('2026-05-25', 'Welfare, volunteer and on-ground logistics', 1800, 'out', 'Bank', 'Welfare'),
  ('2026-05-25', 'Event ticket sales', 13000, 'in', 'Bank', 'Paradox'),
  ('2026-05-26', 'Welfare, volunteer and on-ground logistics', 60, 'out', 'Bank', 'Welfare'),
  ('2026-05-26', 'Event ticket sales', 64150, 'in', 'Bank', 'Paradox'),
  ('2026-05-26', 'Prizes and participant costs', 2000, 'out', 'Bank', 'Paradox'),
  ('2026-05-27', 'Welfare, volunteer and on-ground logistics', 573, 'out', 'Bank', 'Welfare'),
  ('2026-05-27', 'Stationery and small furniture', 1475, 'out', 'Bank', 'Organisation'),
  ('2026-05-27', 'Event ticket sales', 8400, 'in', 'Bank', 'Paradox'),
  ('2026-05-27', 'Stationery and small furniture', 4260, 'out', 'Bank', 'Organisation'),
  ('2026-05-28', 'Venue and decor', 2295, 'out', 'Bank', 'Paradox'),
  ('2026-05-28', 'Refunds issued to participants', 750, 'out', 'Bank', 'Paradox'),
  ('2026-05-28', 'Refunds issued to participants', 750, 'out', 'Bank', 'Paradox'),
  ('2026-05-28', 'Refunds issued to participants', 750, 'out', 'Bank', 'Paradox'),
  ('2026-05-28', 'Refunds issued to participants', 300, 'out', 'Bank', 'Paradox'),
  ('2026-05-28', 'Refunds issued to participants', 200, 'out', 'Bank', 'Paradox'),
  ('2026-05-28', 'Refunds issued to participants', 750, 'out', 'Bank', 'Paradox'),
  ('2026-05-28', 'Event ticket sales', 38751, 'in', 'Bank', 'Paradox'),
  ('2026-05-29', 'Event ticket sales', 5350, 'in', 'Bank', 'Paradox'),
  ('2026-05-30', 'Event ticket sales', 1750, 'in', 'Bank', 'Paradox'),
  ('2026-05-31', 'Event ticket sales', 14700, 'in', 'Bank', 'Paradox'),
  ('2026-06-01', 'Bank fees', 9.2, 'out', 'Bank', 'Organisation'),
  ('2026-06-01', 'Event ticket sales', 2700, 'in', 'Bank', 'Paradox'),
  ('2026-06-02', 'Welfare, volunteer and on-ground logistics', 7000, 'out', 'Bank', 'Welfare'),
  ('2026-06-02', 'Event ticket sales', 3250, 'in', 'Bank', 'Paradox'),
  ('2026-06-02', 'Sound, lights and DJ', 12500, 'out', 'Bank', 'Paradox'),
  ('2026-06-02', 'Welfare, volunteer and on-ground logistics', 5122, 'out', 'Bank', 'Welfare'),
  ('2026-06-03', 'Welfare, volunteer and on-ground logistics', 2000, 'out', 'Bank', 'Welfare'),
  ('2026-06-03', 'Welfare, volunteer and on-ground logistics', 1000, 'out', 'Bank', 'Welfare'),
  ('2026-06-03', 'Welfare, volunteer and on-ground logistics', 3500, 'out', 'Bank', 'Welfare'),
  ('2026-06-03', 'Event ticket sales', 13550, 'in', 'Bank', 'Paradox'),
  ('2026-06-03', 'Welfare, volunteer and on-ground logistics', 5500, 'out', 'Bank', 'Welfare'),
  ('2026-06-03', 'Welfare, volunteer and on-ground logistics', 6634, 'out', 'Bank', 'Welfare'),
  ('2026-06-04', 'Bank fees', 9.2, 'out', 'Bank', 'Organisation'),
  ('2026-06-04', 'Welfare, volunteer and on-ground logistics', 9900, 'out', 'Bank', 'Welfare'),
  ('2026-06-05', 'Venue and decor', 1386, 'out', 'Bank', 'Paradox'),
  ('2026-06-05', 'Venue and decor', 5000, 'out', 'Bank', 'Paradox'),
  ('2026-06-05', 'Venue and decor', 30000, 'out', 'Bank', 'Paradox'),
  ('2026-06-05', 'Welfare, volunteer and on-ground logistics', 3030, 'out', 'Bank', 'Welfare'),
  ('2026-06-05', 'Sound, lights and DJ', 3100, 'out', 'Bank', 'Paradox'),
  ('2026-06-06', 'Sound, lights and DJ', 13000, 'out', 'Bank', 'Paradox'),
  ('2026-06-06', 'Sound, lights and DJ', 295, 'out', 'Bank', 'Paradox'),
  ('2026-06-06', 'Sound, lights and DJ', 2700, 'out', 'Bank', 'Paradox'),
  ('2026-06-06', 'Sound, lights and DJ', 4000, 'out', 'Bank', 'Paradox'),
  ('2026-06-06', 'Sound, lights and DJ', 2000, 'out', 'Bank', 'Paradox'),
  ('2026-06-06', 'Venue and decor', 14000, 'out', 'Bank', 'Paradox'),
  ('2026-06-06', 'Welfare, volunteer and on-ground logistics', 9300, 'out', 'Bank', 'Welfare'),
  ('2026-06-06', 'Welfare, volunteer and on-ground logistics', 2400, 'out', 'Bank', 'Welfare'),
  ('2026-06-06', 'Event ticket sales', 10050, 'in', 'Bank', 'Paradox'),
  ('2026-06-06', 'Sound, lights and DJ', 12500, 'out', 'Bank', 'Paradox'),
  ('2026-06-06', 'Venue and decor', 7200, 'out', 'Bank', 'Paradox'),
  ('2026-06-07', 'Refunds issued to participants', 950, 'out', 'Bank', 'Paradox'),
  ('2026-06-07', 'Technology', 378.36, 'out', 'Bank', 'Organisation'),
  ('2026-06-07', 'Technology', 1871.68, 'out', 'Bank', 'Organisation'),
  ('2026-06-08', 'Refunds issued to participants', 2000, 'out', 'Bank', 'Paradox'),
  ('2026-06-08', 'Refunds issued to participants', 2000, 'out', 'Bank', 'Paradox'),
  ('2026-06-09', 'Sound, lights and DJ', 32000, 'out', 'Bank', 'Paradox'),
  ('2026-06-09', 'Prizes and participant costs', 13000, 'out', 'Bank', 'Paradox'),
  ('2026-06-11', 'Prizes and participant costs', 6000, 'out', 'Bank', 'Paradox'),
  ('2026-06-12', 'Welfare, volunteer and on-ground logistics', 1650, 'out', 'Bank', 'Welfare'),
  ('2026-06-13', 'Bank fees', 15.63, 'out', 'Bank', 'Organisation'),
  ('2026-06-13', 'Bank fees', 77.31, 'out', 'Bank', 'Organisation'),
  ('2026-06-15', 'Prizes and participant costs', 950, 'out', 'Bank', 'Paradox'),
  ('2026-06-15', 'Prizes and participant costs', 2000, 'out', 'Bank', 'Paradox'),
  ('2026-06-15', 'Prizes and participant costs', 1000, 'out', 'Bank', 'Paradox'),
  ('2026-06-15', 'Prizes and participant costs', 450, 'out', 'Bank', 'Paradox'),
  ('2026-06-16', 'Prizes and participant costs', 250, 'out', 'Bank', 'Paradox'),
  ('2026-06-16', 'Prizes and participant costs', 250, 'out', 'Bank', 'Paradox'),
  ('2026-06-23', 'Stationery and small furniture', 304, 'out', 'Bank', 'Organisation'),
  ('2026-06-24', 'Stationery and small furniture', 271, 'out', 'Bank', 'Organisation'),
  ('2026-06-25', 'Sound, lights and DJ', 7000, 'out', 'Bank', 'Paradox'),
  ('2026-06-25', 'Refunds issued to participants', 4500, 'out', 'Bank', 'Paradox'),
  ('2026-06-30', 'Welfare, volunteer and on-ground logistics', 1500, 'out', 'Bank', 'Welfare'),
  ('2026-06-30', 'Welfare, volunteer and on-ground logistics', 700, 'out', 'Bank', 'Welfare'),
  ('2026-06-30', 'Welfare, volunteer and on-ground logistics', 300, 'out', 'Bank', 'Welfare'),
  ('2026-07-04', 'Welfare, volunteer and on-ground logistics', 620, 'out', 'Bank', 'Welfare'),
  ('2026-07-06', 'Technology', 11305, 'out', 'Bank', 'Organisation'),
  ('2026-07-06', 'Technology', 11259, 'out', 'Bank', 'Organisation'),
  ('2026-07-08', 'Stationery and small furniture', 1030, 'out', 'Bank', 'Organisation'),
  ('2026-07-11', 'Stationery and small furniture', 560, 'out', 'Bank', 'Organisation'),
  ('2026-07-15', 'Stationery and small furniture', 450, 'out', 'Bank', 'Organisation'),
  ('2026-07-26', 'Stationery and small furniture', 325, 'out', 'Bank', 'Organisation'),
  ('2026-07-27', 'Welfare, volunteer and on-ground logistics', 250, 'out', 'Bank', 'Welfare'),
  ('2026-07-27', 'Welfare, volunteer and on-ground logistics', 750, 'out', 'Bank', 'Welfare'),
  ('2026-07-28', 'Stationery and small furniture', 2500, 'out', 'Bank', 'Organisation'),
  ('2026-07-28', 'Stationery and small furniture', 730, 'out', 'Bank', 'Organisation'),
  ('2026-08-01', 'Refunds issued to participants', 1000, 'out', 'Bank', 'Paradox'),
  ('2026-08-02', 'Bank fees', 6.37, 'out', 'Bank', 'Organisation'),
  ('2026-08-05', 'Stationery and small furniture', 1004, 'out', 'Bank', 'Organisation'),
  ('2026-08-07', 'Stationery and small furniture', 233, 'out', 'Bank', 'Organisation'),
  ('2026-08-28', 'Contribution from CRFTD', 10558.75, 'in', 'Bank', 'CRFTD');

-- ── Verification, re-run after applying (all confirmed live 2026-09-24) ────
-- select policyname, cmd, roles, qual, with_check from pg_policies
--   where tablename in ('public_ledger','ledger_comments');
-- select table_name, grantee, string_agg(privilege_type, ',' order by privilege_type)
--   from information_schema.role_table_grants
--   where table_name in ('public_ledger','ledger_comments') and grantee in ('anon','authenticated')
--   group by table_name, grantee;
--   -- expect: public_ledger/anon = SELECT only; public_ledger/authenticated = DELETE,INSERT,SELECT,UPDATE
--   --         ledger_comments/anon = INSERT only; ledger_comments/authenticated = INSERT,SELECT,UPDATE
-- select count(*), sum(amount) filter (where flow='in'), sum(amount) filter (where flow='out')
--   from public.public_ledger;
--   -- expect: 149 rows, in 355972.58, out 403736.85 (rounds to the PRD's ₹3,55,973 / ₹4,03,737)
-- set local role anon; select count(*) from public.public_ledger;              -- expect 149
-- set local role anon; insert into public.ledger_comments (category, body) values ('x','test');  -- expect success
-- set local role anon; select * from public.ledger_comments;                   -- expect permission denied (no SELECT grant)
