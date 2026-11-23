-- Weekly nudge: solved bug and feature reports that no leader has verified yet.
-- Owner chose this on 6 Nov 2026 ("weekly leader nudge"). Audience: active hr and super_admin members, the same
-- people is_super_admin() covers. One notification per person per week, only when something is waiting.
-- Counts only; no report text, no member data in the message. Rollback:
--   select cron.unschedule('bug-verify-nudge'); drop function public.nudge_unverified_fixes();

create or replace function public.nudge_unverified_fixes()
returns integer
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_bugs int; v_feats int; v_sent int := 0;
begin
  select count(*) filter (where kind = 'bug'), count(*) filter (where kind = 'feature')
    into v_bugs, v_feats
    from public.bug_reports
   where solved and not verified and declined_reason is null;
  if coalesce(v_bugs, 0) + coalesce(v_feats, 0) = 0 then return 0; end if;

  insert into public.notifications (member_id, type, title, subtitle, link)
  select m.member_id, 'system',
         format('%s fixed report%s waiting for your check', v_bugs + v_feats, case when v_bugs + v_feats = 1 then '' else 's' end),
         format('%s bug%s and %s idea%s marked fixed. Open each one, confirm it works, and tap verify.',
                v_bugs, case when v_bugs = 1 then '' else 's' end, v_feats, case when v_feats = 1 then '' else 's' end),
         '/bugs'
    from public.members m
   where m.status = 'active' and m.deleted_at is null and m.role in ('hr', 'super_admin');
  get diagnostics v_sent = row_count;
  return v_sent;
end $$;
revoke all on function public.nudge_unverified_fixes() from public, anon, authenticated;

-- Mondays 04:30 UTC (10:00 in Kolkata).
select cron.schedule('bug-verify-nudge', '30 4 * * 1', $$select public.nudge_unverified_fixes()$$);

-- STATUS: APPLIED 6 Nov 2026 (migration bug_verify_nudge_20261106). Scheduled, not yet run; first send is the next Monday.
