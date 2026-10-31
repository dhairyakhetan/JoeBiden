-- ============================================================================
-- STATUS: APPLIED live 2026-09-06 via Supabase MCP (project hzowuwffjqtgszecngpe).
-- Migration names (apply_migration, run in this order):
--   1. profile_wall_schema_2026_09_06        - table, index, members.wall_enabled,
--                                               RLS policies, the two triggers
--   2. profile_wall_storage_2026_09_06       - the `wall-images` storage bucket
--   3. profile_wall_purge_cron_2026_09_06    - the 30-day hard-delete pg_cron job
--   4. profile_wall_notifications_2026_09_06 - create_notification() batching
--   5. profile_wall_members_column_grants_2026_09_06 - CRITICAL FIX #1 (§8 below)
--   6. profile_wall_fix_auth_uid_grant_gap_2026_09_06 - CRITICAL FIX #2 (§9 below)
--   7. profile_wall_lock_trigger_fn_grants_2026_09_06 - minor grant hygiene (§10)
--
-- TWO REAL BUGS WERE FOUND AND FIXED AFTER MIGRATIONS 1-4, NOT BY RE-RUNNING
-- THE SAME VERIFICATION QUERIES, BUT BY ACTUALLY LOADING /member/:uuid IN A
-- REAL SIGNED-OUT BROWSER SESSION. Every verification query in this file's
-- first draft ran through the Supabase MCP connection, which is a privileged
-- role that bypasses ordinary grants - so it reported everything as working
-- while a real anon/authenticated client hit "permission denied for table
-- members" on almost every wall query. This is exactly the failure mode
-- CLAUDE.md's migration-paper-trail note warns about, and the fix was to
-- stop trusting the privileged connection's success and open the actual app:
--   FIX #1 (§8): `members.wall_enabled` was never column-granted to
--     anon/authenticated - this DB uses an explicit column allow-list on
--     `members`, not a blanket table grant, and a brand-new column isn't
--     automatically covered by it.
--   FIX #2 (§9): the RLS policies/trigger that resolve "which member is
--     this session" via a raw `members.auth_uid = auth.uid()` subquery also
--     failed - `authenticated` has no column grant on `auth_uid` at all
--     (by design, unlike wall_enabled this one should NOT just be granted -
--     see §9's own comment). Fixed by routing through a new SECURITY
--     DEFINER helper, `current_member_uuid()`, matching this codebase's own
--     existing current_member_id()/is_director() pattern.
-- Both were then verified end-to-end with REAL simulated anon/authenticated
-- sessions (`set local role authenticated; set local request.jwt.claims`),
-- not just the privileged connection - see §8/§9's own comments for the
-- exact positive AND negative cases exercised (legitimate insert, an
-- impersonation attempt correctly rejected, an unrelated third party's
-- soft-delete correctly no-op'ing, the legitimate recipient's soft-delete
-- correctly stamping deleted_by, a body edit still rejected, and a plain
-- member correctly seeing zero leader-only removed-note rows while a real
-- director/super_admin session sees them) - plus a live logged-out browser
-- re-check confirming the original error was gone.
--
-- Also verified live (§1-7, first pass): RLS on with exactly 4 policies at
-- the right roles, wall_enabled boolean not-null default true, both
-- triggers attached, the bucket + its 3 storage policies, the cron job
-- scheduled and active, create_notification()'s new branch present, and a
-- functional smoke test (insert/immutability-guard/soft-delete/rate-limit)
-- against two live member rows, cleaned up afterward.
--
-- FEATURE (changelog/16-profile-wall.md): the profile wall. Anyone signed in
-- can leave a short public note on another member's profile; the recipient
-- (or the author) can remove it; a removed note is kept 30 days so a HoD can
-- review it before it is gone for good, then purged automatically.
-- ============================================================================


-- ────────────────────────────────────────────────────────────────────────────
-- 1. SCHEMA - copied EXACTLY from the approved §16.0 spec. Do not redesign it.
-- ────────────────────────────────────────────────────────────────────────────

create table if not exists public.profile_notes (
  id             uuid primary key default gen_random_uuid(),
  recipient_uuid uuid not null references public.members(uuid) on delete cascade,
  author_uuid    uuid not null references public.members(uuid) on delete cascade,
  body           text not null check (char_length(body) <= 280),
  image_url      text,
  label          text,                          -- one of lib/categories.ts's 5 slugs, nullable
  created_at     timestamptz not null default now(),
  deleted_at     timestamptz,                    -- SOFT DELETE. Never a hard DELETE from the app.
  deleted_by     uuid references public.members(uuid)
);

create index if not exists profile_notes_recipient_created_idx
  on public.profile_notes (recipient_uuid, created_at desc)
  where deleted_at is null;

-- A second index for the leader-review query (§16's resolved Unresolved #2),
-- which scans the OPPOSITE half of the table (deleted_at IS NOT NULL) ordered
-- by removal time - the partial index above deliberately excludes these rows.
create index if not exists profile_notes_removed_idx
  on public.profile_notes (deleted_at desc)
  where deleted_at is not null;

-- Rate-limit / dedup queries below scan by (author_uuid, created_at) and
-- (author_uuid, recipient_uuid, created_at) over the last hour; this index
-- backs both without a second bespoke one.
create index if not exists profile_notes_author_created_idx
  on public.profile_notes (author_uuid, created_at desc);

alter table public.members add column if not exists wall_enabled boolean not null default true;

comment on table public.profile_notes is
  'changelog/16-profile-wall.md. Public notes left on a member''s profile wall. deleted_at is a SOFT delete only - kept 30 days (purge_old_deleted_profile_notes(), scheduled via pg_cron) so a HoD can review a removed note before it is gone. body/label/image_url/author_uuid/recipient_uuid/created_at are immutable after insert (see profile_notes_guard_update()); only deleted_at/deleted_by may ever change.';
comment on column public.members.wall_enabled is
  'changelog/16-profile-wall.md. Owner-only off-switch for their profile wall. Turning it off HIDES notes (RLS), never deletes them - flipping back on restores every one.';


-- ────────────────────────────────────────────────────────────────────────────
-- 2. RLS - §16.0's four rules, translated onto this codebase's real auth
--    linkage. NOTE ON A REAL MISMATCH (reported, not silently reconciled):
--    §16.0 states the insert check as literally `author_uuid = auth.uid()`.
--    In the live schema `members.uuid` is a public-facing identifier
--    (default uuid_generate_v4(), used in /member/:uuid, /profile/:uuid) and
--    is NEVER equal to auth.uid() - the column that IS auth.uid() is the
--    separate `members.auth_uid`. Every existing RLS policy and helper in
--    this database (is_director(), is_super_admin(), get_own_member(),
--    create_notification(), the blogs/yearbook/member_breaks policies, ...)
--    resolves "which member is this session" via
--    `members.auth_uid = auth.uid()`, never via `members.uuid`. A literal
--    `author_uuid = auth.uid()` policy would silently reject every insert
--    forever (a uuid_generate_v4() value can never equal an auth.users id).
--    So this migration follows the CODE's convention instead of the spec's
--    literal text, per WORKFLOW.md ("if an instruction contradicts the code,
--    the code wins - report it"): `author_uuid` must equal the CALLING
--    member's OWN `members.uuid`, resolved through `auth_uid = auth.uid()`.
--
--    UPDATE, same session: the `profile_notes_insert` and
--    `profile_notes_update_soft_delete` policies as first written below (a
--    raw `members.auth_uid = auth.uid()` subquery) turned out to be
--    unusable by a REAL authenticated client for a different reason -
--    `authenticated` has no column grant on `auth_uid` at all. §9 further
--    down DROPs and re-CREATEs both, routed through a new
--    `current_member_uuid()` SECURITY DEFINER helper instead. The versions
--    immediately below are what shipped for a few minutes, kept here only
--    so this file is an honest record of what actually happened - the
--    LIVE, CURRENT definitions are the ones in §9, not these.
-- ────────────────────────────────────────────────────────────────────────────

alter table public.profile_notes enable row level security;

-- SELECT (public - visitors included): a live, non-deleted note on a wall
-- that is currently on. Deliberately re-checks wall_enabled here (not just
-- at insert time) so flipping the switch off HIDES already-written notes
-- without touching a row - the whole point of the off-switch being reversible.
create policy profile_notes_select_public
  on public.profile_notes
  for select
  to anon, authenticated
  using (
    deleted_at is null
    and exists (
      select 1 from public.members r
      where r.uuid = profile_notes.recipient_uuid
        and r.wall_enabled = true
    )
  );

-- SELECT (leaders reviewing removed notes) - §16's Unresolved #2, RESOLVED:
-- "HoDs can review removed notes." is_director() already covers
-- director/hod/hr/super_admin (see lib/roles.ts's hasLeaderAccess - the two
-- are the same access tier under different names). Deliberately NOT gated
-- on wall_enabled: a member can turn their wall off after removing an
-- abusive note, and the moderation trail must still work.
create policy profile_notes_select_removed_for_leaders
  on public.profile_notes
  for select
  to authenticated
  using (
    deleted_at is not null
    and public.is_director()
  );

-- INSERT: any authenticated, APPROVED (status='active') member, posting as
-- themselves, onto a wall that is currently on.
create policy profile_notes_insert
  on public.profile_notes
  for insert
  to authenticated
  with check (
    exists (
      select 1 from public.members me
      where me.auth_uid = auth.uid()
        and me.status = 'active'
        and me.uuid = profile_notes.author_uuid
    )
    and exists (
      select 1 from public.members r
      where r.uuid = profile_notes.recipient_uuid
        and r.wall_enabled = true
    )
  );

-- UPDATE (soft delete only - enforced structurally by
-- profile_notes_guard_update() below, not just by convention): the recipient
-- OR the author, and only them.
create policy profile_notes_update_soft_delete
  on public.profile_notes
  for update
  to authenticated
  using (
    exists (
      select 1 from public.members me
      where me.auth_uid = auth.uid()
        and (me.uuid = profile_notes.recipient_uuid or me.uuid = profile_notes.author_uuid)
    )
  )
  with check (
    exists (
      select 1 from public.members me
      where me.auth_uid = auth.uid()
        and (me.uuid = profile_notes.recipient_uuid or me.uuid = profile_notes.author_uuid)
    )
  );

-- `wall_enabled` on members: no new policy needed. The existing
-- "Users can update own member row" policy (auth_uid = auth.uid()) already
-- makes it writable only by its owner for any ordinary member; the existing
-- "Directors can update members" policy also lets a director/HoD edit it as
-- part of their general (pre-existing, broad) member-row-editing power - the
-- same power that already lets them edit school_id/role/status during
-- approvals. No wall-specific UI ever exposes toggling ANOTHER member's
-- wall_enabled, so in practice it is owner-only; narrowing the DB-level
-- grant further would need a column-privilege change affecting every other
-- field directors already edit on a member row, which is out of this file's
-- scope and not something §16.0 asked for.


-- ────────────────────────────────────────────────────────────────────────────
-- 3. Guard trigger - "nobody may edit body after insert" (§16.0), enforced
--    structurally rather than left to app discipline. Only deleted_at /
--    deleted_by may ever change after the initial insert. Also stamps
--    deleted_by from the session rather than trusting a client-supplied
--    value (defense in depth on top of the UPDATE policy above).
-- ────────────────────────────────────────────────────────────────────────────

create or replace function public.profile_notes_guard_update()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.body           is distinct from old.body
     or new.label       is distinct from old.label
     or new.image_url   is distinct from old.image_url
     or new.recipient_uuid is distinct from old.recipient_uuid
     or new.author_uuid    is distinct from old.author_uuid
     or new.created_at     is distinct from old.created_at
  then
    raise exception 'profile_notes: only deleted_at/deleted_by may change after insert - body is immutable';
  end if;

  if new.deleted_at is not null and old.deleted_at is null then
    -- A fresh soft-delete: stamp who did it from the session, ignoring
    -- whatever the client sent (deleted_by is not editable client input).
    new.deleted_by := (select uuid from public.members where auth_uid = auth.uid());
  elsif new.deleted_at is null then
    -- Restoring a note (deleted_at cleared) clears the attribution with it.
    new.deleted_by := null;
  end if;

  return new;
end;
$$;

drop trigger if exists profile_notes_guard_update_trg on public.profile_notes;
create trigger profile_notes_guard_update_trg
  before update on public.profile_notes
  for each row execute function public.profile_notes_guard_update();


-- ────────────────────────────────────────────────────────────────────────────
-- 4. Rate limit - §16's Unresolved #6 ("worth one line in the RLS policy or
--    a DB trigger... say the word"). A public, unauthenticated-readable
--    insert surface with zero limit is a spam vector on a page a stranger's
--    image can reach with no filter beyond checkText() (§16.2's own accepted
--    risk). Two caps, simple and generous enough not to bother a real member:
--      - at most 3 notes from one author to the same recipient per hour
--        (matches the "3 in an hour" batching threshold in §16.4 - if you've
--        hit the notification batch, you've also hit the insert cap)
--      - at most 15 notes from one author, to ANYONE, per hour (blunts a
--        script flooding many different profiles rather than one)
--    SECURITY DEFINER so the count is accurate regardless of what the calling
--    session's own RLS would let it SELECT - same idiom create_notification()
--    already uses for its like/follow/tag 24h dedup.
-- ────────────────────────────────────────────────────────────────────────────

create or replace function public.profile_notes_rate_limit_guard()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_pair_count   integer;
  v_author_count integer;
begin
  select count(*) into v_pair_count
  from public.profile_notes
  where author_uuid = new.author_uuid
    and recipient_uuid = new.recipient_uuid
    and created_at > now() - interval '1 hour';

  if v_pair_count >= 3 then
    raise exception 'You have already left a few notes here recently - try again later.';
  end if;

  select count(*) into v_author_count
  from public.profile_notes
  where author_uuid = new.author_uuid
    and created_at > now() - interval '1 hour';

  if v_author_count >= 15 then
    raise exception 'You are posting notes faster than we allow - take a short break and try again soon.';
  end if;

  return new;
end;
$$;

drop trigger if exists profile_notes_rate_limit_trg on public.profile_notes;
create trigger profile_notes_rate_limit_trg
  before insert on public.profile_notes
  for each row execute function public.profile_notes_rate_limit_guard();


-- ────────────────────────────────────────────────────────────────────────────
-- 5. Storage - a wall note's one optional image. New bucket, mirroring the
--    existing `post-images`/`avatars` convention exactly (public bucket +
--    authenticated-owner INSERT; a public bucket serves its objects via the
--    CDN public-URL path, which bypasses these SELECT policies entirely - the
--    policies below only govern the authenticated download/list API).
-- ────────────────────────────────────────────────────────────────────────────

insert into storage.buckets (id, name, public)
values ('wall-images', 'wall-images', true)
on conflict (id) do nothing;

create policy "Public read wall-images"
  on storage.objects for select
  using (bucket_id = 'wall-images');

create policy "Authenticated users can upload wall images"
  on storage.objects for insert
  with check (bucket_id = 'wall-images' and auth.uid() = owner);

-- Own-upload cleanup only (e.g. the note insert failed after the image
-- upload succeeded) - mirrors profileService.uploadAvatar's rollback. No
-- general UPDATE policy: a wall image is never replaced in place.
create policy "Owners can delete own wall image"
  on storage.objects for delete
  using (bucket_id = 'wall-images' and auth.uid() = owner);


-- ────────────────────────────────────────────────────────────────────────────
-- 6. The 30-day purge - §16's Unresolved #1, RESOLVED. pg_cron IS installed
--    on this project (v1.6.4) and already runs publish_due_scheduled_posts()
--    every minute (scheduled_posts_2026_07.sql) - this follows that exact
--    same pattern, not a manual-query placeholder. Once daily is plenty for
--    a 30-day-old cutoff (unlike the minute-precision publisher).
-- ────────────────────────────────────────────────────────────────────────────

create or replace function public.purge_old_deleted_profile_notes()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  n integer;
begin
  with gone as (
    delete from public.profile_notes
     where deleted_at is not null
       and deleted_at < now() - interval '30 days'
    returning id
  )
  select count(*) into n from gone;
  return n;
end;
$$;

comment on function public.purge_old_deleted_profile_notes() is
  'Hard-deletes profile_notes rows soft-deleted more than 30 days ago. Scheduled daily via pg_cron (job "purge-old-wall-notes"). Does NOT clean up the associated wall-images storage object if any - an accepted, documented cost, same as profileService.uploadAvatar''s own best-effort-only orphan cleanup elsewhere in this app.';

revoke execute on function public.purge_old_deleted_profile_notes() from public, anon, authenticated;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'purge-old-wall-notes') then
    perform cron.unschedule('purge-old-wall-notes');
  end if;
end $$;

select cron.schedule('purge-old-wall-notes', '17 3 * * *',
                      'select public.purge_old_deleted_profile_notes();');


-- ────────────────────────────────────────────────────────────────────────────
-- 7. Notifications - §16.4. Adds ONE new, narrowly-scoped branch to the
--    shared create_notification() RPC for a new 'wall_note' type, batched
--    ("if three arrive within an hour, one row saying so" - §16.4): if the
--    recipient already has a wall_note notification from the last hour, this
--    is a silent no-op rather than a second row. Every other type's behavior
--    (system/post_approved/.../like/follow/tag's existing 24h dedup) is
--    UNCHANGED - only an additional `elsif` branch is added.
--    'wall_note' needs no new allow-list entry: notifications.type is plain
--    text with no CHECK constraint, and create_notification()'s authority
--    checks only restrict 'system' and the four leader-only types - a new
--    type outside those two lists was already insertable by any authenticated
--    caller before this change; only the batching window is new.
-- ────────────────────────────────────────────────────────────────────────────

create or replace function public.create_notification(
  p_member_id integer,
  p_type text,
  p_title text,
  p_subtitle text default null,
  p_full_note text default null,
  p_link text default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception 'must be authenticated to create a notification';
  end if;

  if p_type = 'system' and not (public.is_director() or public.is_super_admin()) then
    raise exception 'not authorized to create a % notification', p_type;
  end if;

  if p_type in ('post_approved','post_rejected','team_invite','team_join_accepted')
     and not (
       public.is_director()
       or public.is_super_admin()
       or exists (
         select 1 from public.members
         where auth_uid = auth.uid()
           and role::text = 'lead'
           and status::text = 'active'
       )
     ) then
    raise exception 'not authorized to create a % notification', p_type;
  end if;

  if p_link is not null and (p_link not like '/%' or p_link like '//%') then
    raise exception 'notification link must be an app-internal path';
  end if;

  if p_type in ('like','follow','tag') and exists (
    select 1 from public.notifications n
    where n.member_id = p_member_id
      and n.type = p_type
      and coalesce(n.link, '') = coalesce(p_link, '')
      and n.created_at > now() - interval '24 hours'
  ) then
    return;
  end if;

  -- ADDED for changelog/16-profile-wall.md §16.4: a wall note is generic
  -- ("someone left a note on your wall" - no author name, by the file's own
  -- approved copy), so simple existence-in-the-last-hour is the whole
  -- batching rule - no per-author/per-link matching needed, unlike the
  -- like/follow/tag case above which dedups a specific (actor, link) pair.
  if p_type = 'wall_note' and exists (
    select 1 from public.notifications n
    where n.member_id = p_member_id
      and n.type = 'wall_note'
      and n.created_at > now() - interval '1 hour'
  ) then
    return;
  end if;

  insert into public.notifications (member_id, type, title, subtitle, full_note, link)
  values (p_member_id, p_type, p_title, p_subtitle, p_full_note, p_link);
end;
$$;


-- ────────────────────────────────────────────────────────────────────────────
-- 8. CRITICAL FIX #1, found by loading a real /member/:uuid page signed out
--    right after sections 1-4 above: `wallService.getWall()` failed with
--    "permission denied for table members... GRANT SELECT ON public.members
--    TO anon" on its `select('wall_enabled')` call. This database uses an
--    EXPLICIT COLUMN-LEVEL allow-list on `members` for anon/authenticated
--    (see members_pii_lockdown_2026_07_29.sql / stage2_revoke.sql) rather
--    than a blanket table grant, so a brand-new column is not automatically
--    covered - it needs its own explicit grant, same as every other
--    non-PII column already on the list (birthday_public, break_end, ...).
--    wall_enabled carries no PII, so a plain grant (not a SECURITY DEFINER
--    wrapper) is the right fix here, unlike §9 below.
-- ────────────────────────────────────────────────────────────────────────────

grant select (wall_enabled) on public.members to anon, authenticated;
grant update (wall_enabled) on public.members to authenticated;


-- ────────────────────────────────────────────────────────────────────────────
-- 9. CRITICAL FIX #2, found immediately after §8 by simulating a real
--    authenticated INSERT (`set local role authenticated; set local
--    request.jwt.claims = ...`) rather than trusting the privileged MCP
--    connection: still "permission denied for table members", this time
--    because profile_notes_insert's WITH CHECK, profile_notes_update_
--    soft_delete's USING/WITH CHECK, and profile_notes_guard_update()'s
--    deleted_by stamp all resolved "which member is this session" via a raw
--    `members.auth_uid = auth.uid()` subquery - and `authenticated` has NO
--    column grant on `auth_uid` at all (confirmed absent from its grant
--    list, unlike status/uuid/wall_enabled).
--
--    UNLIKE §8, the fix here is NOT "grant the column": auth_uid is an
--    internal identity-linking column, and a broad grant would let any
--    authenticated member read any OTHER member's internal Supabase Auth
--    user id via an arbitrary query - a real information-leak this app's
--    own security history takes seriously (see profileService.ts's
--    claim_member_preauth() comment on a prior identity-trust
--    vulnerability). Every OTHER place in this codebase that resolves
--    auth.uid() -> a members row (current_member_id(), is_director(),
--    get_own_member(), ...) already goes through a SECURITY DEFINER
--    function for exactly this reason - it was never a raw grant, it's a
--    deliberate bypass built into the function. This adds the same pattern
--    for the uuid form (none of the existing helpers return it) and
--    repoints the three places that had a raw subquery at it.
-- ────────────────────────────────────────────────────────────────────────────

create or replace function public.current_member_uuid()
returns uuid
language sql
stable security definer
set search_path = public, pg_temp
as $$
  select uuid from public.members where auth_uid = auth.uid();
$$;

revoke all on function public.current_member_uuid() from public, anon;
grant execute on function public.current_member_uuid() to authenticated;

comment on function public.current_member_uuid() is
  'SECURITY DEFINER resolution of the calling session auth.uid() to its members.uuid (the public-facing id, not member_id) - mirrors current_member_id()/get_current_member_id() for the uuid form. Exists because authenticated has no column-grant on members.auth_uid by design, so any RLS policy or trigger resolving identity must go through a SECURITY DEFINER function rather than a raw subquery. Added for changelog/16-profile-wall.md''s profile_notes policies.';

drop policy if exists profile_notes_insert on public.profile_notes;
create policy profile_notes_insert
  on public.profile_notes
  for insert
  to authenticated
  with check (
    profile_notes.author_uuid = public.current_member_uuid()
    and exists (
      select 1 from public.members me
      where me.uuid = profile_notes.author_uuid
        and me.status = 'active'
    )
    and exists (
      select 1 from public.members r
      where r.uuid = profile_notes.recipient_uuid
        and r.wall_enabled = true
    )
  );

drop policy if exists profile_notes_update_soft_delete on public.profile_notes;
create policy profile_notes_update_soft_delete
  on public.profile_notes
  for update
  to authenticated
  using (public.current_member_uuid() in (profile_notes.recipient_uuid, profile_notes.author_uuid))
  with check (public.current_member_uuid() in (profile_notes.recipient_uuid, profile_notes.author_uuid));

create or replace function public.profile_notes_guard_update()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.body           is distinct from old.body
     or new.label       is distinct from old.label
     or new.image_url   is distinct from old.image_url
     or new.recipient_uuid is distinct from old.recipient_uuid
     or new.author_uuid    is distinct from old.author_uuid
     or new.created_at     is distinct from old.created_at
  then
    raise exception 'profile_notes: only deleted_at/deleted_by may change after insert - body is immutable';
  end if;

  if new.deleted_at is not null and old.deleted_at is null then
    new.deleted_by := public.current_member_uuid();
  elsif new.deleted_at is null then
    new.deleted_by := null;
  end if;

  return new;
end;
$$;


-- ────────────────────────────────────────────────────────────────────────────
-- 10. Grant hardening - found by get_advisors(security) immediately after
--     applying section 4. Both functions are trigger-only; revoking direct
--     PUBLIC/anon/authenticated EXECUTE does not affect the triggers, which
--     fire independent of the grant system.
-- ────────────────────────────────────────────────────────────────────────────

revoke execute on function public.profile_notes_rate_limit_guard() from public, anon, authenticated;
revoke execute on function public.profile_notes_guard_update() from public, anon, authenticated;


-- ============================================================================
-- VERIFICATION - run after applying. Every line should report the stated
-- expectation; this migration is not "APPLIED" in the header above until
-- these were actually re-run live and matched (learned the hard way, twice -
-- CLAUDE.md's migration-paper-trail-drift note).
-- ============================================================================
--
-- table + column exist:
--   select table_name from information_schema.tables where table_name='profile_notes';
--   select column_name, data_type, is_nullable from information_schema.columns
--    where table_name='members' and column_name='wall_enabled';
--
-- RLS is on and exactly 4 policies exist:
--   select relrowsecurity from pg_class where relname='profile_notes';
--   select policyname, cmd from pg_policies where tablename='profile_notes' order by policyname;
--
-- the guard trigger really blocks a body edit (run as any member, expect an error):
--   update profile_notes set body = 'x' where id = '<some id>';
--
-- the rate limit trigger is attached:
--   select tgname from pg_trigger where tgrelid = 'public.profile_notes'::regclass and not tgisinternal;
--
-- storage bucket + policies exist:
--   select id, public from storage.buckets where id = 'wall-images';
--   select policyname from pg_policies where schemaname='storage' and tablename='objects'
--    and policyname ilike '%wall%';
--
-- the cron job is scheduled and active:
--   select jobid, jobname, schedule, active from cron.job where jobname = 'purge-old-wall-notes';
--
-- create_notification() carries the new branch:
--   select prosrc from pg_proc where proname = 'create_notification' and prosrc ilike '%wall_note%';
--
-- §8/§9's grants are actually in place (the check that would have caught
-- both critical fixes before shipping, if run against anon/authenticated
-- specifically rather than the privileged connection):
--   select grantee, privilege_type from information_schema.column_privileges
--    where table_name='members' and column_name='wall_enabled' and grantee in ('anon','authenticated');
--   select grantee from information_schema.routine_privileges
--    where routine_name='current_member_uuid';  -- expect authenticated only, never anon
--
-- THE REAL TEST: simulate an actual anon/authenticated session, not the
-- privileged MCP connection - this is what actually caught both bugs:
--   set local role authenticated;
--   set local request.jwt.claims = '{"sub":"<a real auth_uid>","role":"authenticated"}';
--   select public.current_member_uuid();  -- expect that member's own uuid, not an error
--   insert into profile_notes (recipient_uuid, author_uuid, body) values (...);  -- as that member, for themselves
-- ============================================================================
