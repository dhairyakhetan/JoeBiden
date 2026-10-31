-- 2026-10-20: organisation-wide task totals for HR and super admin (counts only).
--
-- Owner decision 2026-10-20 (docs/plans/task-tracker.md): build the counts-only SECURITY DEFINER function.
-- Row security keeps task CONTENT private; this returns only counts per team per month, so HR and super admin
-- can see on-time rate and workload across every task, private ones included, without ever reading a title.
--
-- Who may call it:
--   hr, super_admin  -> every team, plus tasks with no team (team_id null, team_name null)
--   hod, director    -> only the teams they are an active member of
--   anyone else      -> raises 'not allowed'
--
-- Defaults used (open sub-questions in the plan): monthly counts, team totals only (no per-person rows).
--
-- Re-running is safe (create or replace, grants are idempotent). Status is recorded in the PR that adds this file.
--
-- Advisor note: one authenticated-callable SECURITY DEFINER function is the known cost of exposing any RPC.

create or replace function private.task_totals_impl(p_months integer)
returns table (
  team_id integer,
  team_name text,
  month date,
  created integer,
  completed integer,
  completed_on_time integer,
  open_overdue integer
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  me_id integer;
  me_role text;
begin
  select m.member_id, m.role into me_id, me_role
    from public.members m
   where m.auth_uid = auth.uid() and m.status = 'active'
   limit 1;

  if me_id is null or me_role not in ('hr', 'super_admin', 'hod', 'director') then
    raise exception 'not allowed' using errcode = '42501';
  end if;

  return query
  with scoped as (
    select t.*
      from public.tasks t
     where t.created_at >= date_trunc('month', (now() at time zone 'Asia/Kolkata')) - make_interval(months => greatest(p_months, 1) - 1)
       and (
         me_role in ('hr', 'super_admin')
         or t.team_id in (
              select tm.team_id from public.team_members tm
               where tm.member_id = me_id and tm.is_active is true and tm.left_at is null
            )
       )
  )
  select s.team_id,
         tn.name::text,
         date_trunc('month', s.created_at at time zone 'Asia/Kolkata')::date,
         count(*)::integer,
         (count(*) filter (where s.completed_at is not null))::integer,
         (count(*) filter (where s.completed_at is not null and (s.due_at is null or s.completed_at <= s.due_at)))::integer,
         (count(*) filter (where s.completed_at is null and s.due_at is not null and s.due_at < now()))::integer
    from scoped s
    left join public.teams tn on tn.team_id = s.team_id
   group by s.team_id, tn.name, date_trunc('month', s.created_at at time zone 'Asia/Kolkata')
   order by 3 desc, 2;
end;
$$;

create or replace function public.task_totals(p_months integer default 6)
returns table (
  team_id integer,
  team_name text,
  month date,
  created integer,
  completed integer,
  completed_on_time integer,
  open_overdue integer
)
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  select * from private.task_totals_impl(p_months);
$$;

revoke all on function private.task_totals_impl(integer) from public, anon;
revoke all on function public.task_totals(integer) from public, anon;
grant execute on function private.task_totals_impl(integer) to authenticated;
grant execute on function public.task_totals(integer) to authenticated;
