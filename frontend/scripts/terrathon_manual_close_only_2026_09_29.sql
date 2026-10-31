-- TerraThon: registrations close ONLY when an admin sets status = 'closed'.
--
-- Before: `accepting` was also false once closes_at passed or once held >= cap,
-- and terrathon_register() rejected past closes_at. Cricket showed "Registrations
-- closed" while its status was 'open' (17 held vs cap 16), and the admin switch
-- could not reopen it.
--
-- After: status = 'open' is the whole rule. closes_at stays as a displayed
-- deadline but no longer blocks. terrathon_register() already files anyone past
-- the cap as 'waitlist' (v_held >= cap), so an over-full sport keeps taking
-- names as a waitlist instead of shutting the door.
--
-- Status: APPLIED LIVE 2026-09-29 (community project).

create or replace view public.terrathon_public_events as
  select e.slug, e.display_name, e.status, e.fee_inr, e.team_size_min, e.team_size_max,
         e.roster_min_at_signup, e.prize_pool_inr, e.prize_split, e.venue, e.venue_map_url,
         e.day_first, e.day_last, e.report_time, e.match_window, e.rules_md, e.closes_at,
         e.sort_order,
         held.n >= greatest(1, e.cap * 7 / 10) as filling_fast,
         e.status = 'open'::text               as accepting
    from public.terrathon_events e
    cross join lateral ( select count(*)::integer as n
                           from public.terrathon_registrations r
                          where r.event_id = e.id
                            and (r.status <> all (array['cancelled'::text, 'waitlist'::text, 'hold_expired'::text]))
                            and (r.paid or r.utr is not null
                                 or r.hold_expires_at is null
                                 or r.hold_expires_at > now()) ) held;

-- terrathon_register(): the EVENT_CLOSED test becomes status-only. Apply by
-- re-running the function body from terrathon_schema_2026_09_21.sql with
--   if v_event.status <> 'open' then
-- in place of the status-or-closes_at condition.
