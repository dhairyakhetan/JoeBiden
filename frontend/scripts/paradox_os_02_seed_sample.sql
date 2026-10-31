-- ──────────────────────────────────────────────────────────────────────────
-- Paradox OS · Phase 2 seed — give every existing event a workspace + the
-- standard runbook + starter requirements, so the OS is demoable on REAL
-- events immediately (no blank state). This is the realistic stand-in for the
-- workbook importers until the source .xlsx files are added to the repo.
--
-- Run AFTER paradox_os_01_schema.sql, in the PARADOX SQL editor. Idempotent —
-- every insert is guarded so re-running never duplicates.
-- ──────────────────────────────────────────────────────────────────────────

-- 1. One workspace per event, config seeded from the event's existing fields.
insert into public.paradox_event_workspaces (event_id, status, config, head_confirmed)
select e.id,
       case when e.active then 'live' else 'draft' end,
       jsonb_strip_nulls(jsonb_build_object(
         'venue', e.venue, 'entry_fee', e.fee, 'team_size', e.team_size,
         'format', e.team_format, 'cap', e.max_participants,
         'date', e.date, 'time', e.time, 'prize_split', e.prize
       )),
       false
from public.paradox_events e
on conflict (event_id) do nothing;

-- 2. Standard runbook skeleton (seeded once; the common EVENT FLOW).
insert into public.paradox_runbook_templates
  (applies_to, phase, task, owner_role, due_offset, auto_condition, is_gate, sort_order)
select * from (values
  ('all','reg',      'Confirm event head & co-head',                 'core','T-14d', null,                true,  10),
  ('all','reg',      'Finalise rules & rubric, publish to event page','head','T-10d', null,                true,  20),
  ('all','reg',      'Open registrations (greenlight)',              'core','T-10d', 'greenlit',          true,  30),
  ('all','reg',      'Hit breakeven',                                'head','T-3d',  'breakeven_reached', false, 40),
  ('all','logistics','Collect requirements list & assign owners',    'head','T-7d',  null,                false, 50),
  ('all','logistics','Confirm judges (odd-numbered panel)',          'head','T-3d',  null,                true,  60),
  ('all','logistics','Publish fixtures / schedule',                  'head','T-2d',  'fixtures_published',true,  70),
  ('all','on_day',   'Volunteer & judge check-in',                   'head','T-0',   null,                false, 80),
  ('all','on_day',   'Run event per published fixtures',             'head','T-0',   null,                false, 90),
  ('all','on_day',   'Enter results in rubric',                      'head','T-0',   'results_entered',   true,  100),
  ('all','post',     'Publish winners + generate certificates',      'head','post',  'results_published', false, 110),
  ('all','post',     'Send thank-you message + photos',              'head','post',  null,                false, 120)
) as v(applies_to,phase,task,owner_role,due_offset,auto_condition,is_gate,sort_order)
where not exists (select 1 from public.paradox_runbook_templates where applies_to='all');

-- 3. Instantiate the templates as live steps for every event missing them.
insert into public.paradox_runbook_steps
  (event_id, phase, task, owner_role, due_offset, auto_condition, is_gate, sort_order)
select e.id, t.phase, t.task, t.owner_role, t.due_offset, t.auto_condition, t.is_gate, t.sort_order
from public.paradox_events e
cross join public.paradox_runbook_templates t
where t.applies_to = 'all'
  and not exists (
    select 1 from public.paradox_runbook_steps s
    where s.event_id = e.id and s.task = t.task
  );

-- 4. Starter requirements per event (generic; replace via importer later).
insert into public.paradox_requirements (event_id, category, item, qty, source, sort_order)
select e.id, c.category, c.item, c.qty, c.source, c.sort_order
from public.paradox_events e
cross join (values
  ('Print',     'Certificates (winner / runner-up / participation)', 'as needed', 'print_internal', 10),
  ('Print',     'Event signage & directions',                        '2',         'print_internal', 20),
  ('Venue',     'Tables & chairs',                                   'as needed', 'venue',          30),
  ('Tech',      'Sound system / mic',                                '1',         'vendor',         40),
  ('Stationery','Score sheets & pens',                               'as needed', 'buy',            50)
) as c(category,item,qty,source,sort_order)
where not exists (select 1 from public.paradox_requirements r where r.event_id = e.id);

-- Verify counts
select
  (select count(*) from public.paradox_event_workspaces) as workspaces,
  (select count(*) from public.paradox_runbook_steps)    as runbook_steps,
  (select count(*) from public.paradox_requirements)     as requirements;
