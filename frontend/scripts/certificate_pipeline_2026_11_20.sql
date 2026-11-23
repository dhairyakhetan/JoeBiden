-- ═══════════════════════════════════════════════════════════════════════════
-- Certificate pipeline: a member applies, HoDs vouch, Claude drafts, HR decides.
-- 2026-11-20.
--
-- STATUS: **APPLIED to the live database (hzowuwffjqtgszecngpe), confirmed 2026-11-21** by read-only
-- queries: the five new tables and columns exist, 7 document types, all functions present, the old
-- direct INSERT policy gone, RLS on, anon cannot execute the member functions, the three triggers are
-- enabled, and certificate_requests was still empty. It was applied together with the verification
-- migration as one transaction (see certificate_verification_2026_11_20.sql). NOT yet exercised end to
-- end with real accounts: the first real request is that test.
--
-- Written against the live schema checked on 2026-11-20.
--
-- **CHANGED AFTER THE DRY-RUN BELOW (20 Nov 2026).** The owner shared the real Canva templates, so the document
-- types were replaced with the seven real ones (cert_recognition, cert_internship, lor, letter_recognition,
-- letter_internship, letter_acceptance, letter_offer), `certificate_types` gained kind/structured/routine_drafts, every
-- request now carries a required period (period_start / period_end), submit_certificate_requests() takes the two months,
-- and fixed-wording certificates are drafted at submit. The dry-run result below describes the EARLIER version.
-- (The changed version was dry-run by the owner as one rolled-back transaction before it was applied.)
--
-- DRY-RUN 2026-11-20 (earlier version): the whole script plus a 36-step scenario ran in one
-- transaction that ended by raising, so nothing persisted (re-queried
-- afterwards: no new table, no new column, insert policy still present). As
-- the real roles (`set local role authenticated` with a real auth uid) it
-- proved: a member submits two documents, the duplicate / no-HoD / zero-hours /
-- wrong-sub-team / tag-a-plain-member / no-team cases are refused; a member
-- reads 0 HoD answers, 0 notes and 0 drafts, and a draft only after issue;
-- direct INSERT is refused and a self-issue UPDATE touches 0 rows; a tagged HoD
-- can answer and paste text, an untagged HoD can only note; HR cannot issue
-- with no text, a spoofed decided_by is overwritten with the real HR member, an
-- issued request cannot be declined, requested hours cannot be edited, nobody
-- can draft or issue their own request; anon cannot execute the RPCs.
-- To apply: the Supabase SQL editor, or apply_migration with this file.
--
-- Depends on: certificate_requests_2026_08_31.sql, _hr_only_2026_09_05.sql,
-- _stop_trusting_the_requester_2026_09_12.sql and the live
-- `certificate_requests_no_reopen` trigger (all applied).
--
-- WHAT CHANGES
-- ────────────
-- 1. `certificate_types`: the kinds of document a member can ask for, as DATA.
--    Adding the Canva templates the owner is still to share is one row each, not
--    a deploy. The `drafting_brief` column is what the drafting routine follows.
-- 2. `certificate_requests` stays ONE ROW PER DOCUMENT, and gains
--    `submission_id` (documents asked for together), `claimed_min_hours`.
--    A member now asks for several documents at once and the desk clubs every
--    open document of one member into a single case.
-- 3. Tags: `certificate_request_hods` (which HoDs vouch, and each one's answer),
--    `certificate_request_teams` (teams AND sub-teams the member worked in).
-- 4. `certificate_request_notes`: leader-only comments. The member never reads
--    these, nor the HoD answers.
-- 5. `certificate_drafts`: the text of the document. A separate table so RLS can
--    hide it from the member until HR has issued it (RLS is row-level, and a
--    column revoke on this table is the exact trap CLAUDE.md warns about).
-- 6. All member and HoD writes go through SECURITY DEFINER functions. The old
--    direct INSERT policy is DROPPED, so nobody can skip validation by calling
--    PostgREST directly.
-- 7. The guard trigger is widened: immutable columns stay immutable, `decided_by`
--    is stamped by the database (the app used to send it, so any HR user could
--    sign a decision as someone else), nobody decides their own request, and a
--    request cannot be issued with no text.
--
-- DECISION FLAGGED FOR THE OWNER
-- ──────────────────────────────
-- `claimed_min_hours` is typed by the member. On 2026-09-12 the opposite was
-- fixed on purpose (a member could write their own hours and mark the request
-- issued). That fix is KEPT: `hours_at_request` is still stamped by the
-- database from drive_attendance and the member cannot touch it. The new column
-- sits beside it and is always shown as "claimed", never as verified. Live
-- today `drive_attendance` has 0 rows, so the verified figure is 0 for everyone
-- and the claim is the only figure there is. HR approving is what vouches for it.
--
-- TO REVERSE (nothing here deletes data that existed before it ran; the table
-- had 0 rows on 2026-11-20): drop the five new tables, drop the five functions,
-- drop the two added columns and the unique index, re-add
-- certificate_requests_doc_type_check and certificate_requests_insert_own
-- from the 2026-08-31 and 2026-09-12 files, and restore the old no_reopen body
-- (`if old.status <> 'pending' and new.status is distinct from old.status then
-- raise exception 'certificate_already_decided' using errcode = 'P0001'; end if;`).
-- ═══════════════════════════════════════════════════════════════════════════

begin;

-- ── 1. Document types, as data ──────────────────────────────────────────────
create table if not exists public.certificate_types (
  key                   text primary key check (key ~ '^[a-z][a-z0-9_]{1,30}$'),
  label                 text not null,
  blurb                 text not null,
  kind                  text not null default 'letter' check (kind in ('certificate', 'letter')),
  layout                text not null default 'portrait' check (layout in ('landscape', 'portrait')),
  needs_hod             boolean not null default true,
  structured            boolean not null default false,
  routine_drafts        boolean not null default true,
  has_standard_wording  boolean not null default false,
  drafting_brief        text not null,
  sample_image_url      text,
  display_order         integer not null default 0,
  is_active             boolean not null default true
);

comment on table public.certificate_types is
  'The documents a member can ask for. needs_hod: at least one HoD must be tagged. has_standard_wording: the desk offers a one-click fixed sentence so HR need not wait for a draft. drafting_brief: the rules the drafting routine follows for this type. sample_image_url: optional exported template; the site draws a sample itself when null.';

insert into public.certificate_types
  (key, label, blurb, kind, layout, needs_hod, structured, routine_drafts, has_standard_wording, drafting_brief, display_order) values
  ('cert_recognition', 'Certificate of Recognition',
   'A landscape certificate with your name, the hours you gave and the months you were with us.',
   'certificate', 'landscape', false, true, false, true,
   'Fixed wording filled from the request: the name, the claimed minimum hours and the period. Nothing is drafted.', 10),
  ('cert_internship', 'Certificate of Internship',
   'The same certificate for an internship. If you were part of AQ.Ventures it carries the AQ.Ventures wording.',
   'certificate', 'landscape', false, true, false, true,
   'Fixed wording filled from the request: the name, the claimed minimum hours and the period. Nothing is drafted.', 20),
  ('lor', 'Letter of Recommendation',
   'A letter a school, college or employer can read. The HoDs you tag vouch for you.',
   'letter', 'portrait', true, false, true, false,
   'A letter of four short paragraphs, roughly 220 to 320 words. Do not write the salutation or the closing: the page adds "To whomsoever it may concern," and "Sincerely, Krish Goenka, Founder, AquaTerra". Paragraph 1: one sentence on AquaTerra (a student-led non-profit organisation based in Kolkata, committed to promoting social and environmental welfare through youth-driven initiatives), then "We are pleased to write this letter of recommendation for <name>, who <has been / was> associated with AquaTerra from <start month, year> to <end month, year or present>" and the qualities the member listed or a leader noted. Paragraph 2: "During their time with AquaTerra" and the teams and sub-teams they served in, with any role the team records show, and the claimed minimum hours. Paragraph 3: "What truly distinguishes <first name> is" one strength the record supports. Paragraph 4: "We are confident that <first name> will bring the same level of responsibility, commitment, and enthusiasm to any future endeavour, and wholeheartedly wish them the very best for all their ambitions and pursuits." Never invent a project, event, title, grade, result or number.',
   30),
  ('letter_recognition', 'Letter of Recognition',
   'A letter acknowledging what you did and the way you showed up.',
   'letter', 'portrait', true, false, true, false,
   'The same form and length as a letter of recommendation, but framed as recognition: "We are pleased to write this letter of recognition for <name>". Acknowledge the contributions the member described and the teams they served in, and state the period and the claimed minimum hours. No salutation or closing: the page adds them. Never invent an event, award, title or result.',
   40),
  ('letter_internship', 'Letter of Internship',
   'Confirms an internship: the dates, the hours and what you worked on.',
   'letter', 'portrait', true, false, true, false,
   'Open with the AquaTerra sentence, then "This is to certify that <name> interned with us from <start month, year> to <end month, year>, completing a total of at least <hours> hours of service." Follow with one or two paragraphs on what they worked on, from the teams and the qualities listed, and close with "We are glad to certify the successful completion of <first name>''s internship and extend our best wishes for their future pursuits." No salutation, no closing: the page adds the salutation and no sign-off. Never invent dates, hours, tasks or results.',
   50),
  ('letter_acceptance', 'Letter of Acceptance',
   'Accepts you to volunteer with AquaTerra. Written by HR.',
   'letter', 'portrait', false, false, false, false,
   'Written by HR. The routine does not draft this type: it holds a home address and a college, which the request does not carry.',
   60),
  ('letter_offer', 'Offer Letter',
   'An offer to join AquaTerra. Written by HR.',
   'letter', 'portrait', false, false, false, false,
   'Written by HR. The routine does not draft this type.',
   70)
on conflict (key) do nothing;

alter table public.certificate_types enable row level security;
revoke all on public.certificate_types from anon, authenticated;
grant select on public.certificate_types to authenticated;

drop policy if exists certificate_types_select on public.certificate_types;
create policy certificate_types_select on public.certificate_types
  for select to authenticated using (true);

-- ── 2. certificate_requests: one row per document ───────────────────────────
alter table public.certificate_requests drop constraint if exists certificate_requests_doc_type_check;
alter table public.certificate_requests drop constraint if exists certificate_requests_doc_type_fkey;
alter table public.certificate_requests
  add constraint certificate_requests_doc_type_fkey
  foreign key (doc_type) references public.certificate_types (key);

alter table public.certificate_requests
  add column if not exists submission_id uuid not null default gen_random_uuid();

alter table public.certificate_requests
  add column if not exists claimed_min_hours numeric(6,1)
  check (claimed_min_hours is null or (claimed_min_hours >= 1 and claimed_min_hours <= 2000));

alter table public.certificate_requests add column if not exists period_start date;
alter table public.certificate_requests add column if not exists period_end date;
alter table public.certificate_requests drop constraint if exists certificate_requests_period_order;
alter table public.certificate_requests
  add constraint certificate_requests_period_order check (period_start is null or period_end is null or period_start <= period_end);

comment on column public.certificate_requests.period_start is
  'First day of the month the member says they started. Typed by the member, shown as a claim. Locked once filed.';
comment on column public.certificate_requests.period_end is
  'First day of the month the member says they finished (the current month if still with AQ). Typed by the member, shown as a claim.';

comment on column public.certificate_requests.claimed_min_hours is
  'The MINIMUM hours the member says they worked. Typed by the member, unverified, always shown as a claim. hours_at_request is the database-derived figure and is unrelated to it.';
comment on column public.certificate_requests.submission_id is
  'Documents asked for in one go share this. The desk clubs by member, not by submission.';

create unique index if not exists certificate_requests_one_pending_per_type
  on public.certificate_requests (member_id, doc_type) where status = 'pending';
create index if not exists certificate_requests_submission_idx
  on public.certificate_requests (submission_id);

-- Members no longer insert directly. submit_certificate_requests() is the only way in.
drop policy if exists certificate_requests_insert_own on public.certificate_requests;
revoke insert on public.certificate_requests from anon, authenticated;

-- ── 3. Tags ─────────────────────────────────────────────────────────────────
create table if not exists public.certificate_request_hods (
  request_id     integer not null references public.certificate_requests (id) on delete cascade,
  hod_member_id  integer not null references public.members (member_id) on delete cascade,
  response       text check (response in ('approve', 'disapprove', 'clueless')),
  responded_at   timestamptz,
  primary key (request_id, hod_member_id)
);
create index if not exists certificate_request_hods_hod_idx on public.certificate_request_hods (hod_member_id);

create table if not exists public.certificate_request_teams (
  id           integer generated always as identity primary key,
  request_id   integer not null references public.certificate_requests (id) on delete cascade,
  team_id      integer not null references public.teams (team_id),
  sub_team_id  integer references public.sub_teams (sub_team_id)
);
create unique index if not exists certificate_request_teams_unique
  on public.certificate_request_teams (request_id, team_id, coalesce(sub_team_id, 0));

comment on table public.certificate_request_teams is
  'Where the member worked. A row with sub_team_id null tags a team (or a child team such as Social Media); a row with sub_team_id tags that sub-team (such as LinkedIn Team). Inactive teams and sub-teams are allowed on purpose: alumni ask too.';

-- ── 4. Leader-only notes ────────────────────────────────────────────────────
create table if not exists public.certificate_request_notes (
  id          integer generated always as identity primary key,
  request_id  integer not null references public.certificate_requests (id) on delete cascade,
  author_id   integer not null references public.members (member_id) on delete cascade,
  body        text not null check (char_length(btrim(body)) between 1 and 1000),
  created_at  timestamptz not null default now()
);
create index if not exists certificate_request_notes_request_idx on public.certificate_request_notes (request_id, created_at);

-- ── 5. The text of the document ─────────────────────────────────────────────
create table if not exists public.certificate_drafts (
  request_id  integer primary key references public.certificate_requests (id) on delete cascade,
  body        text not null check (char_length(btrim(body)) between 1 and 4000),
  source      text not null check (source in ('claude', 'manual', 'standard')),
  drafted_by  integer references public.members (member_id) on delete set null,
  drafted_at  timestamptz not null default now()
);

comment on table public.certificate_drafts is
  'claude: written by the drafting routine. manual: pasted or edited by HR or a tagged HoD (overrides claude). standard: the fixed wording of a type with has_standard_wording. The routine never overwrites manual or standard.';

-- ── RLS and grants for the four new tables ──────────────────────────────────
alter table public.certificate_request_hods  enable row level security;
alter table public.certificate_request_teams enable row level security;
alter table public.certificate_request_notes enable row level security;
alter table public.certificate_drafts        enable row level security;

revoke all on public.certificate_request_hods  from anon, authenticated;
revoke all on public.certificate_request_teams from anon, authenticated;
revoke all on public.certificate_request_notes from anon, authenticated;
revoke all on public.certificate_drafts        from anon, authenticated;
grant select on public.certificate_request_hods  to authenticated;
grant select on public.certificate_request_teams to authenticated;
grant select on public.certificate_request_notes to authenticated;
grant select on public.certificate_drafts        to authenticated;

-- HoD answers and notes: leaders only, and never the person they are about.
drop policy if exists certificate_request_hods_select on public.certificate_request_hods;
create policy certificate_request_hods_select on public.certificate_request_hods
  for select to authenticated
  using (
    (public.is_director() or public.is_super_admin())
    and not exists (
      select 1 from public.certificate_requests r
      where r.id = certificate_request_hods.request_id
        and r.member_id = public.get_current_member_id()
    )
  );

drop policy if exists certificate_request_notes_select on public.certificate_request_notes;
create policy certificate_request_notes_select on public.certificate_request_notes
  for select to authenticated
  using (
    (public.is_director() or public.is_super_admin())
    and not exists (
      select 1 from public.certificate_requests r
      where r.id = certificate_request_notes.request_id
        and r.member_id = public.get_current_member_id()
    )
  );

-- The teams a member tagged: the member can read their own, leaders read all.
drop policy if exists certificate_request_teams_select on public.certificate_request_teams;
create policy certificate_request_teams_select on public.certificate_request_teams
  for select to authenticated
  using (
    public.is_director() or public.is_super_admin()
    or exists (
      select 1 from public.certificate_requests r
      where r.id = certificate_request_teams.request_id
        and r.member_id = public.get_current_member_id()
    )
  );

-- The text: leaders always; the member only once HR has issued it.
drop policy if exists certificate_drafts_select on public.certificate_drafts;
create policy certificate_drafts_select on public.certificate_drafts
  for select to authenticated
  using (
    public.is_director() or public.is_super_admin()
    or exists (
      select 1 from public.certificate_requests r
      where r.id = certificate_drafts.request_id
        and r.member_id = public.get_current_member_id()
        and r.status = 'issued'
    )
  );

-- ── 7. Guard trigger (replaces the body of certificate_requests_no_reopen) ──
create or replace function public.certificate_requests_no_reopen()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  me integer := public.get_current_member_id();
begin
  -- A decision is final (unchanged rule).
  if old.status <> 'pending' and new.status is distinct from old.status then
    raise exception 'certificate_already_decided' using errcode = 'P0001';
  end if;

  -- What was asked for never changes after the fact, for anyone.
  if new.member_id is distinct from old.member_id
     or new.doc_type is distinct from old.doc_type
     or new.claimed_min_hours is distinct from old.claimed_min_hours
     or new.submission_id is distinct from old.submission_id
     or new.requested_at is distinct from old.requested_at
     or new.period_start is distinct from old.period_start
     or new.period_end is distinct from old.period_end
     or new.hours_at_request is distinct from old.hours_at_request
     or new.drive_count_at_request is distinct from old.drive_count_at_request
     or new.date_range_start is distinct from old.date_range_start
     or new.date_range_end is distinct from old.date_range_end
     or new.member_note is distinct from old.member_note then
    raise exception 'certificate_field_locked' using errcode = 'P0001';
  end if;

  if new.status is distinct from old.status then
    if new.status = 'issued'
       and not exists (select 1 from public.certificate_drafts d where d.request_id = new.id) then
      raise exception 'certificate_needs_text' using errcode = 'P0001';
    end if;
    -- A signed-in decider is stamped by the database, never trusted from the client.
    if auth.uid() is not null then
      if me is null then raise exception 'certificate_not_signed_in' using errcode = 'P0001'; end if;
      new.decided_by := me;
      new.decided_at := now();
    end if;
    if new.decided_by is not null and new.decided_by = new.member_id then
      raise exception 'certificate_own_request' using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.certificate_requests_no_reopen() from anon, authenticated, public;

drop trigger if exists certificate_requests_no_reopen on public.certificate_requests;
create trigger certificate_requests_no_reopen
  before update on public.certificate_requests
  for each row execute function public.certificate_requests_no_reopen();

-- ── The member's one way in ─────────────────────────────────────────────────
create or replace function public.submit_certificate_requests(
  p_doc_types   text[],
  p_hod_ids     integer[],
  p_teams       jsonb,
  p_min_hours   numeric,
  p_period_start date,
  p_period_end   date,
  p_highlights  text default null
)
returns table (request_id integer, request_doc_type text)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  me         integer := public.get_current_member_id();
  my_name    text;
  my_status  text;
  v_types    text[];
  v_hods     integer[];
  v_needs    boolean;
  v_sub      uuid := gen_random_uuid();
  v_note     text := nullif(btrim(coalesce(p_highlights, '')), '');
  v_labels   text;
  v_ps       date;
  v_pe       date;
  v_hours    text;
  v_id       integer;
  k          text;
  h          integer;
  t          record;
begin
  if auth.uid() is null or me is null then
    raise exception 'certificate_not_signed_in' using errcode = 'P0001';
  end if;
  select full_name, status::text into my_name, my_status from public.members where member_id = me;
  if my_status is distinct from 'active' then
    raise exception 'certificate_members_only' using errcode = 'P0001';
  end if;

  v_types := array(select distinct x from unnest(coalesce(p_doc_types, '{}'::text[])) x);
  if coalesce(array_length(v_types, 1), 0) = 0 then
    raise exception 'certificate_pick_a_type' using errcode = 'P0001';
  end if;
  if array_length(v_types, 1) > 8 then
    raise exception 'certificate_too_many_types' using errcode = 'P0001';
  end if;
  if exists (
    select 1 from unnest(v_types) x
    where not exists (select 1 from public.certificate_types ct where ct.key = x and ct.is_active)
  ) then
    raise exception 'certificate_unknown_type' using errcode = 'P0001';
  end if;

  if p_min_hours is null or p_min_hours < 1 or p_min_hours > 2000 then
    raise exception 'certificate_bad_hours' using errcode = 'P0001';
  end if;
  if char_length(coalesce(p_highlights, '')) > 1000 then
    raise exception 'certificate_highlights_too_long' using errcode = 'P0001';
  end if;

  -- The period is two months, stored as the first day of each. End may be the current month ("still with AQ"), never later.
  if p_period_start is null or p_period_end is null then
    raise exception 'certificate_bad_period' using errcode = 'P0001';
  end if;
  v_ps := date_trunc('month', p_period_start)::date;
  v_pe := date_trunc('month', p_period_end)::date;
  if v_ps < date '2021-01-01' or v_ps > v_pe or v_pe > date_trunc('month', current_date)::date then
    raise exception 'certificate_bad_period' using errcode = 'P0001';
  end if;
  v_hours := trim_scale(round(p_min_hours, 1))::text;

  v_hods := array(select distinct x from unnest(coalesce(p_hod_ids, '{}'::integer[])) x);
  if coalesce(array_length(v_hods, 1), 0) > 10 then
    raise exception 'certificate_too_many_hods' using errcode = 'P0001';
  end if;
  if exists (
    select 1 from unnest(v_hods) x
    where x = me
       or not exists (
         select 1 from public.members m
         where m.member_id = x and m.status::text = 'active' and m.role::text in ('hod', 'director')
       )
  ) then
    raise exception 'certificate_bad_hod' using errcode = 'P0001';
  end if;
  select bool_or(ct.needs_hod) into v_needs from public.certificate_types ct where ct.key = any(v_types);
  if coalesce(v_needs, false) and coalesce(array_length(v_hods, 1), 0) = 0 then
    raise exception 'certificate_pick_a_hod' using errcode = 'P0001';
  end if;

  if jsonb_typeof(p_teams) is distinct from 'array' or jsonb_array_length(p_teams) = 0 then
    raise exception 'certificate_pick_a_team' using errcode = 'P0001';
  end if;
  if jsonb_array_length(p_teams) > 16 then
    raise exception 'certificate_too_many_teams' using errcode = 'P0001';
  end if;
  for t in
    select (e ->> 'team_id')::integer as team_id, nullif(e ->> 'sub_team_id', '')::integer as sub_team_id
    from jsonb_array_elements(p_teams) e
  loop
    if not exists (select 1 from public.teams tm where tm.team_id = t.team_id) then
      raise exception 'certificate_bad_team' using errcode = 'P0001';
    end if;
    if t.sub_team_id is not null
       and not exists (select 1 from public.sub_teams st where st.sub_team_id = t.sub_team_id and st.team_id = t.team_id) then
      raise exception 'certificate_bad_team' using errcode = 'P0001';
    end if;
  end loop;

  if exists (
    select 1 from public.certificate_requests r
    where r.member_id = me and r.status = 'pending' and r.doc_type = any(v_types)
  ) then
    raise exception 'certificate_already_pending' using errcode = 'P0001';
  end if;

  foreach k in array v_types loop
    insert into public.certificate_requests (member_id, doc_type, member_note, claimed_min_hours, period_start, period_end, submission_id)
    values (me, k, v_note, round(p_min_hours, 1), v_ps, v_pe, v_sub)
    returning id into v_id;

    -- Fixed-wording documents (the certificates) are drafted right here, so HR can decide without waiting for a run.
    if exists (select 1 from public.certificate_types ct where ct.key = k and ct.structured) then
      insert into public.certificate_drafts (request_id, body, source, drafted_by)
      values (v_id,
        'This is to certify that ' || my_name || ' has been a valuable part of our organization and contributed over ' || v_hours
          || ' hours to our welfare endeavours between ' || to_char(v_ps, 'FMMonth, YYYY') || ' and ' || to_char(v_pe, 'FMMonth, YYYY') || '.',
        'standard', null);
    end if;

    foreach h in array v_hods loop
      insert into public.certificate_request_hods (request_id, hod_member_id) values (v_id, h);
    end loop;

    insert into public.certificate_request_teams (request_id, team_id, sub_team_id)
    select distinct v_id, (e ->> 'team_id')::integer, nullif(e ->> 'sub_team_id', '')::integer
    from jsonb_array_elements(p_teams) e
    on conflict do nothing;

    request_id := v_id;
    request_doc_type := k;
    return next;
  end loop;

  -- Tell each tagged HoD once, however many documents were asked for.
  select string_agg(ct.label, ', ' order by ct.display_order) into v_labels
  from public.certificate_types ct where ct.key = any(v_types);
  foreach h in array v_hods loop
    insert into public.notifications (member_id, type, title, subtitle, link)
    values (h, 'system', my_name || ' tagged you on a certificate request',
            'Asked for: ' || v_labels || '. Say whether you can vouch for them.', '/director/certificates');
  end loop;
end;
$$;

-- ── A tagged HoD answers ────────────────────────────────────────────────────
create or replace function public.certificate_respond(p_request_id integer, p_response text, p_note text default null)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  me      integer := public.get_current_member_id();
  v_state text;
  v_note  text := nullif(btrim(coalesce(p_note, '')), '');
begin
  if auth.uid() is null or me is null then raise exception 'certificate_not_signed_in' using errcode = 'P0001'; end if;
  if p_response is null or p_response not in ('approve', 'disapprove', 'clueless') then
    raise exception 'certificate_bad_response' using errcode = 'P0001';
  end if;
  if char_length(coalesce(v_note, '')) > 1000 then raise exception 'certificate_note_too_long' using errcode = 'P0001'; end if;

  select r.status into v_state from public.certificate_requests r where r.id = p_request_id;
  if v_state is null then raise exception 'certificate_not_found' using errcode = 'P0001'; end if;
  if v_state <> 'pending' then raise exception 'certificate_already_decided' using errcode = 'P0001'; end if;

  update public.certificate_request_hods
     set response = p_response, responded_at = now()
   where request_id = p_request_id and hod_member_id = me;
  if not found then raise exception 'certificate_not_tagged' using errcode = 'P0001'; end if;

  if v_note is not null then
    insert into public.certificate_request_notes (request_id, author_id, body) values (p_request_id, me, v_note);
  end if;
end;
$$;

-- ── Any leader adds a note ──────────────────────────────────────────────────
create or replace function public.certificate_add_note(p_request_id integer, p_body text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  me      integer := public.get_current_member_id();
  v_state text;
  v_owner integer;
  v_body  text := btrim(coalesce(p_body, ''));
begin
  if auth.uid() is null or me is null then raise exception 'certificate_not_signed_in' using errcode = 'P0001'; end if;
  if not (public.is_director() or public.is_super_admin()) then raise exception 'certificate_leaders_only' using errcode = 'P0001'; end if;
  if char_length(v_body) < 1 or char_length(v_body) > 1000 then raise exception 'certificate_bad_note' using errcode = 'P0001'; end if;
  select r.status, r.member_id into v_state, v_owner from public.certificate_requests r where r.id = p_request_id;
  if v_state is null then raise exception 'certificate_not_found' using errcode = 'P0001'; end if;
  if v_owner = me then raise exception 'certificate_own_request' using errcode = 'P0001'; end if;
  if v_state <> 'pending' then raise exception 'certificate_already_decided' using errcode = 'P0001'; end if;
  insert into public.certificate_request_notes (request_id, author_id, body) values (p_request_id, me, v_body);
end;
$$;

-- ── HR or a tagged HoD pastes or edits the text (the "priority" route) ──────
create or replace function public.certificate_set_draft(p_request_id integer, p_body text, p_source text default 'manual')
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  me      integer := public.get_current_member_id();
  v_state text;
  v_owner integer;
  v_body  text := btrim(coalesce(p_body, ''));
begin
  if auth.uid() is null or me is null then raise exception 'certificate_not_signed_in' using errcode = 'P0001'; end if;
  if p_source not in ('manual', 'standard') then raise exception 'certificate_bad_source' using errcode = 'P0001'; end if;
  if char_length(v_body) < 1 or char_length(v_body) > 4000 then raise exception 'certificate_bad_text' using errcode = 'P0001'; end if;
  select r.status, r.member_id into v_state, v_owner from public.certificate_requests r where r.id = p_request_id;
  if v_state is null then raise exception 'certificate_not_found' using errcode = 'P0001'; end if;
  if v_owner = me then raise exception 'certificate_own_request' using errcode = 'P0001'; end if;
  if v_state <> 'pending' then raise exception 'certificate_already_decided' using errcode = 'P0001'; end if;
  if not (
    public.is_super_admin()
    or exists (select 1 from public.certificate_request_hods h where h.request_id = p_request_id and h.hod_member_id = me)
  ) then
    raise exception 'certificate_not_allowed' using errcode = 'P0001';
  end if;
  insert into public.certificate_drafts (request_id, body, source, drafted_by, drafted_at)
  values (p_request_id, v_body, p_source, me, now())
  on conflict (request_id) do update
    set body = excluded.body, source = excluded.source, drafted_by = excluded.drafted_by, drafted_at = excluded.drafted_at;
end;
$$;

-- ── The picker's list of HoDs, with their teams so a member picks the right one ─
create or replace function public.certificate_hod_options()
returns table (member_id integer, full_name text, avatar_url text, role text, team_names text[])
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select m.member_id, m.full_name::text, m.avatar_url::text, m.role::text,
         coalesce(array(
           select distinct t.name::text
           from public.team_members tm join public.teams t on t.team_id = tm.team_id
           where tm.member_id = m.member_id and tm.is_active
         ), '{}'::text[])
  from public.members m
  where public.get_current_member_id() is not null
    and m.status::text = 'active'
    and m.role::text in ('hod', 'director')
    and m.member_id <> public.get_current_member_id()
  order by m.full_name;
$$;

-- ── Counts for the desk badge and landing ───────────────────────────────────
create or replace function public.certificate_desk_counts()
returns table (pending_total integer, awaiting_my_response integer, awaiting_draft integer)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    count(*) filter (where r.status = 'pending')::integer,
    count(*) filter (where r.status = 'pending' and exists (
      select 1 from public.certificate_request_hods h
      where h.request_id = r.id and h.hod_member_id = public.get_current_member_id() and h.response is null))::integer,
    count(*) filter (where r.status = 'pending' and not exists (
      select 1 from public.certificate_drafts d where d.request_id = r.id))::integer
  from public.certificate_requests r
  where public.is_director() or public.is_super_admin();
$$;

-- Callable by signed-in users only (Supabase grants execute to anon by default).
revoke all on function public.submit_certificate_requests(text[], integer[], jsonb, numeric, date, date, text) from public, anon;
revoke all on function public.certificate_respond(integer, text, text) from public, anon;
revoke all on function public.certificate_add_note(integer, text) from public, anon;
revoke all on function public.certificate_set_draft(integer, text, text) from public, anon;
revoke all on function public.certificate_hod_options() from public, anon;
revoke all on function public.certificate_desk_counts() from public, anon;
grant execute on function public.submit_certificate_requests(text[], integer[], jsonb, numeric, date, date, text) to authenticated;
grant execute on function public.certificate_respond(integer, text, text) to authenticated;
grant execute on function public.certificate_add_note(integer, text) to authenticated;
grant execute on function public.certificate_set_draft(integer, text, text) to authenticated;
grant execute on function public.certificate_hod_options() to authenticated;
grant execute on function public.certificate_desk_counts() to authenticated;

commit;

-- ═══════════════════════════════════════════════════════════════════════════
-- VERIFICATION. Run after applying; paste the result into the STATUS line.
-- ═══════════════════════════════════════════════════════════════════════════
-- Expect 7 types:
--   select key, needs_hod, has_standard_wording from certificate_types order by display_order;
-- Expect NO insert policy on certificate_requests, and the same update/select as before:
--   select policyname, cmd from pg_policies where tablename = 'certificate_requests';
-- Expect no anon execute on any of the six functions (anon must be absent):
--   select proname, proacl from pg_proc where proname in
--     ('submit_certificate_requests','certificate_respond','certificate_add_note',
--      'certificate_set_draft','certificate_hod_options','certificate_desk_counts');
-- Expect a member (not a leader) to read 0 rows of hods/notes and 0 drafts until issued.
