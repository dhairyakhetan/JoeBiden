-- APPLIED LIVE 2026-09-12 via Supabase MCP apply_migration
-- (migration name: posts_update_enforce_category_scope)
--
-- Found in a deep audit of the HoD desk: PostModeration.tsx hides the
-- approve/reject controls for any post category a director/HoD isn't
-- assigned to via director_categories (CategoryManagement.tsx), but the
-- live posts_update RLS policy only ever checked is_director() - role and
-- status, never director_categories. A category-scoped HoD could still
-- approve/reject a post outside their scope with a direct call (devtools,
-- a raw fetch, anything bypassing the UI's own gate). The restriction
-- described in CLAUDE.md's "Category-scoped moderation" section was
-- UI-only, not a real security boundary.
--
-- Semantics matched exactly to PostModeration.tsx's existing client-side
-- logic (see that file's `scopedCategories`/`filterCategories`/`rows`
-- memos): a director/hod with ZERO director_categories rows is unscoped -
-- full access, same as before this migration. A director/hod with one or
-- more rows is restricted to exactly those categories. hr and super_admin
-- are never restricted by category regardless of any director_categories
-- rows they might incidentally have.
--
-- NOTE: an existing function `is_assigned_to_category(cat varchar)` was
-- found live during this work, unattached to any RLS policy. It does NOT
-- match this semantics (it requires an explicit assignment row to return
-- true at all, so a director with zero assignments would get zero access
-- under it, not full access) and does not include the 'hr' role. Left in
-- place as dead code rather than dropped on a guess - do not wire it into
-- anything without reconciling that semantic difference first.

create or replace function public.is_director_for_category(p_category varchar)
returns boolean
language sql
stable
security definer
set search_path = 'public', 'pg_temp'
as $$
  select exists (
    select 1 from public.members m
    where m.auth_uid = auth.uid()
      and m.role in ('director','hod','super_admin','hr')
      and m.status = 'active'
      and (
        m.role in ('super_admin','hr')
        or not exists (select 1 from public.director_categories dc where dc.member_id = m.member_id)
        or exists (
          select 1 from public.director_categories dc
          where dc.member_id = m.member_id and dc.category = p_category
        )
      )
  );
$$;

drop policy if exists posts_update on public.posts;
create policy posts_update on public.posts
for update
using (
  (author_id = get_current_member_id() and status in ('pending_review','rejected'))
  or is_director_for_category(category)
)
with check (
  (author_id = get_current_member_id() and status in ('pending_review','rejected'))
  or is_director_for_category(category)
);

-- Verify:
-- select policyname, cmd, qual from pg_policies where tablename='posts' and cmd='UPDATE';
