-- ============================================================================
-- ✅ APPLIED live 2026-08-30 (via Supabase MCP). Both tables exist, RLS
-- enabled, is_member_of_department() is SECURITY DEFINER, no policy
-- references a raw members.auth_uid subquery.
--
-- SOPs and to-dos desk.
-- Per the Aug 2026 redesign handoff, SOP desk spec.
--
-- WHY: departments run on a mix of standing procedures ("how do we do X",
-- re-run periodically, no urgency) and one-off goals ("get Y done by Z",
-- P1/P2/P3 urgency, a due date). Both are rows in the same `sops` table,
-- distinguished by `kind`, because the desk lists and filters them together
-- and most columns (task, description, led_by, status, notes) mean the same
-- thing for either kind — only urgency and last_run_at are kind-specific,
-- and that's enforced with check constraints below rather than splitting
-- into two tables.
--
-- department_slug, not a department_id FK — departments are NOT a real
-- table in this schema. frontend/src/lib/departments.ts is a TS-level
-- constant (8 teams), and the one place the DB already models "which
-- department" is director_categories.category: a plain text column holding
-- one of 'events' | 'welfare' | 'content' | 'operations' | 'labs' (see
-- is_assigned_to_category() in security_and_correctness_fixes_2026_08_10.sql
-- and DEPARTMENTS[].category in departments.ts — every team maps into one of
-- these 5 verticals, several teams sharing a vertical, e.g. Crftd/AQ.Ventures
-- /ShikshAQ are all 'labs'). sops.department_slug and sop_templates.
-- department_slug reuse that exact same 5-value domain via a check
-- constraint, for consistency with director_categories rather than inventing
-- a second classification scheme. If SOPs later need team-level granularity
-- narrower than these 5 verticals (e.g. Crftd vs AQ.Ventures separately),
-- loosen or drop the check constraint then — don't work around it silently.
--
-- led_by_text vs led_by_member_id — the source data for this desk is a
-- spreadsheet import where "led by" is a human-typed name, not a member
-- reference. led_by_text is kept VERBATIM and permanently (never overwritten
-- once imported) so the original source-of-truth string always survives even
-- import mismatches; led_by_member_id is populated only when that text could
-- be confidently resolved to a real members row, and is what access control
-- and "my to-dos" views should actually key off.
--
-- RLS:
--   - SELECT: any active member of the row's department (via a new
--     is_member_of_department() SECURITY DEFINER helper, mirroring is_team_
--     lead()/is_lead_of_member() rather than inlining a team_members join),
--     or any director/super_admin.
--   - INSERT/DELETE: director/super_admin only (this is an HR/leadership-
--     managed desk — rows come from an import or a director creating a new
--     goal/procedure, not from arbitrary department members).
--   - UPDATE: the resolved owner (led_by_member_id) or a director/
--     super_admin. This is a whole-row UPDATE grant, not column-restricted
--     to just status/notes — RLS can't restrict which columns an UPDATE
--     touches without a BEFORE UPDATE guard trigger (the same mechanism
--     members_guard_privileged_cols uses for members.role/status/etc. in
--     community_security_hardening_2026_06.sql). No such trigger is added
--     here because there's no evidence yet of an owner needing to be
--     stopped from, say, correcting a typo in the task text — if that
--     changes, add a guard trigger the same way, don't hand-roll a new
--     pattern.
--   - sop_templates: read follows the same department-membership rule;
--     write (insert/update/delete) is director/super_admin only — these are
--     canned procedure bodies meant to be curated centrally, not edited by
--     whoever happens to be assigned a task that references them.
-- ============================================================================

-- ── 1. department helper ────────────────────────────────────────────────────
create or replace function public.is_member_of_department(p_slug text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.team_members tm
    join public.teams t on t.team_id = tm.team_id
    where tm.member_id = public.get_current_member_id()
      and tm.is_active = true
      and t.is_active = true
      and t.category = p_slug
  );
$$;

comment on function public.is_member_of_department(text) is
  'True if the caller is an ACTIVE member of any team whose category matches p_slug (the same 5-value department vertical director_categories.category uses). Backs sops/sop_templates read access.';

grant execute on function public.is_member_of_department(text) to authenticated;

-- ── 2. sops ──────────────────────────────────────────────────────────────────
create table if not exists public.sops (
  id              integer generated always as identity primary key,
  department_slug text not null check (department_slug in (
                    'events', 'welfare', 'content', 'operations', 'labs'
                  )),
  sub_division    text,
  task            text not null,
  description     text,
  kind            text not null check (kind in ('procedure', 'goal')),
  urgency         text check (urgency is null or urgency in ('P1', 'P2', 'P3')),
  led_by_text     text not null,
  led_by_member_id integer references public.members(member_id) on delete set null,
  status          text not null default 'not_started'
                    check (status in ('not_started', 'in_progress', 'completed')),
  assigned_on     date,
  due_on          date,
  completed_on    date,
  notes           text,
  doc_links       text[],
  last_run_at     timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint sops_urgency_matches_kind check (
    (kind = 'procedure' and urgency is null)
    or (kind = 'goal' and urgency is not null)
  ),
  constraint sops_last_run_only_for_procedures check (
    last_run_at is null or kind = 'procedure'
  )
);

comment on column public.sops.led_by_text is
  'Verbatim free text from the source sheet. Always kept, even after led_by_member_id resolves — this is the audit trail back to the original import.';

create index if not exists idx_sops_department_slug   on public.sops(department_slug);
create index if not exists idx_sops_led_by_member_id   on public.sops(led_by_member_id);

-- reuse the existing generic updated_at trigger function (confirmed live via
-- ALTER FUNCTION ... SET search_path in security_hardening_2026_05_18.sql) —
-- do not redefine it.
drop trigger if exists sops_set_updated_at on public.sops;
create trigger sops_set_updated_at
  before update on public.sops
  for each row execute function public.update_updated_at_column();

alter table public.sops enable row level security;

drop policy if exists "sops_select_department_or_leaders" on public.sops;
create policy "sops_select_department_or_leaders"
  on public.sops for select
  using (
    public.is_director()
    or public.is_super_admin()
    or public.is_member_of_department(department_slug)
  );

drop policy if exists "sops_insert_leaders" on public.sops;
create policy "sops_insert_leaders"
  on public.sops for insert
  with check (public.is_director() or public.is_super_admin());

drop policy if exists "sops_update_owner_or_leaders" on public.sops;
create policy "sops_update_owner_or_leaders"
  on public.sops for update
  using (
    led_by_member_id = public.get_current_member_id()
    or public.is_director()
    or public.is_super_admin()
  )
  with check (
    led_by_member_id = public.get_current_member_id()
    or public.is_director()
    or public.is_super_admin()
  );

drop policy if exists "sops_delete_leaders" on public.sops;
create policy "sops_delete_leaders"
  on public.sops for delete
  using (public.is_director() or public.is_super_admin());

-- ── 3. sop_templates ─────────────────────────────────────────────────────────
create table if not exists public.sop_templates (
  id              integer generated always as identity primary key,
  department_slug text not null check (department_slug in (
                    'events', 'welfare', 'content', 'operations', 'labs'
                  )),
  label           text not null,
  body            text not null,
  updated_by      integer references public.members(member_id) on delete set null,
  updated_at      timestamptz not null default now()
);

create index if not exists idx_sop_templates_department_slug on public.sop_templates(department_slug);

drop trigger if exists sop_templates_set_updated_at on public.sop_templates;
create trigger sop_templates_set_updated_at
  before update on public.sop_templates
  for each row execute function public.update_updated_at_column();

alter table public.sop_templates enable row level security;

drop policy if exists "sop_templates_select_department_or_leaders" on public.sop_templates;
create policy "sop_templates_select_department_or_leaders"
  on public.sop_templates for select
  using (
    public.is_director()
    or public.is_super_admin()
    or public.is_member_of_department(department_slug)
  );

drop policy if exists "sop_templates_write_leaders" on public.sop_templates;
create policy "sop_templates_write_leaders"
  on public.sop_templates for insert
  with check (public.is_director() or public.is_super_admin());

drop policy if exists "sop_templates_update_leaders" on public.sop_templates;
create policy "sop_templates_update_leaders"
  on public.sop_templates for update
  using (public.is_director() or public.is_super_admin())
  with check (public.is_director() or public.is_super_admin());

drop policy if exists "sop_templates_delete_leaders" on public.sop_templates;
create policy "sop_templates_delete_leaders"
  on public.sop_templates for delete
  using (public.is_director() or public.is_super_admin());

-- ============================================================================
-- VERIFICATION — run after applying. Every line should report OK.
-- ============================================================================
-- Expect: both tables exist, RLS enabled on both
--   select relname, relrowsecurity from pg_class
--    where relname in ('sops', 'sop_templates');
--
-- Expect: 4 policies on sops (select/insert/update/delete), 4 on sop_templates
--   select tablename, policyname, cmd from pg_policies
--    where tablename in ('sops', 'sop_templates') order by tablename, cmd;
--
-- Expect: no policy references a raw `members.auth_uid`/email/phone subquery
--   select policyname from pg_policies
--    where tablename in ('sops', 'sop_templates')
--      and (qual ilike '%auth_uid%' or with_check ilike '%auth_uid%');
--   -- should return 0 rows: every check goes through is_director()/
--   -- is_super_admin()/is_member_of_department()/get_current_member_id(),
--   -- never a raw members subquery.
--
-- Expect: kind/urgency constraint present and correctly shaped
--   select conname, pg_get_constraintdef(oid) from pg_constraint
--    where conrelid = 'public.sops'::regclass
--      and conname = 'sops_urgency_matches_kind';
--
-- Expect: is_member_of_department exists, SECURITY DEFINER
--   select prosecdef from pg_proc where proname = 'is_member_of_department';
