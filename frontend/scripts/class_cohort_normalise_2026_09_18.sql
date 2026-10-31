-- ============================================================================
-- class_cohort_counts(): normalise the cohort labels for /classes
--
--   STATUS: APPLIED 2026-09-18, then SUPERSEDED the same day by
--           class_cohort_normalise_v2_2026_09_18.sql. Kept as the rollback
--           target and for the record. Do not run this to move forward.
--   Run AFTER AUDIT_CUMULATIVE_2026_09_18.sql, which created the function.
--   This is a `create or replace` of that one function. Nothing else changes,
--   no member row is touched, and section 3 rolls it back to the raw version.
--
-- WHY
--   `members.class_grade` is free text and holds 63 distinct values for what is
--   really nine cohorts. /register writes from a fixed 9-option picker, but
--   /profile/edit is a free-text input, and most of the roster came in through
--   the HR workbook import as bare numbers. So the public /classes page shows
--   the same cohort several times over:
--
--     Class 11 -> '11' (278) + 'Class 11' (12) + 'class 11' (2)
--                 + 'Grade 11' (1) + 'grade eleven' (1)   = 294 across 5 rows
--     Class 12 -> '12' (145) + 'Class 12' (12)            = 157 across 2 rows
--     Class 10 -> '10' (115) + 'Class 10' (4)             = 119 across 2 rows
--     Class 9  -> '9'  (102) + 'Class 9'  (7)             = 109 across 2 rows
--
--   Counts captured live 2026-09-18 over the first 1,000 active members.
--
-- THE ONE JUDGEMENT CALL, AND WHOSE IT WAS
--   Bare '1' (131), '2' (44) and '3' (27) are ambiguous: Class 1-3, or College
--   1st-3rd Year. The owner ruled COLLEGE YEARS on 2026-09-18. It is the
--   reading the data supports - /register offers 'College 1st Year' through
--   'College 4th Year' and ten members typed those out in full, while 202
--   primary-school volunteers would be implausible for AquaTerra - but it is a
--   ruling, not something derivable, so it is recorded here rather than buried.
--   If it is ever reversed, change ONLY the `when '1','2','3'` arm below.
--
-- WHAT IS DELIBERATELY NOT NORMALISED
--   Anything this mapping does not recognise is passed through exactly as the
--   member typed it. 'Pass out', 'Entering college', 'Final year' and the rest
--   of the long tail each keep their own row. Forcing them into 'Other' would
--   be inventing an answer on a public page; leaving them visible is honest and
--   makes the mess findable.
--
--   Display only. No member row is rewritten. The desk, search and CVs all keep
--   reading the raw column, so nothing else in the app shifts underneath them.
-- ============================================================================

create or replace function public.class_cohort_counts()
returns table (cohort text, member_count bigint)
language sql
stable
security definer
set search_path = public
as $$
  with normalised as (
    select case lower(trim(m.class_grade))
             -- School classes. The bare numbers are the HR-import spelling.
             when '7'  then 'Class 7'
             when '8'  then 'Class 8'
             when '9'  then 'Class 9'
             when '10' then 'Class 10'
             when '11' then 'Class 11'
             when '12' then 'Class 12'
             when 'class 7'  then 'Class 7'
             when 'class 8'  then 'Class 8'
             when 'class 9'  then 'Class 9'
             when 'class 10' then 'Class 10'
             when 'class 11' then 'Class 11'
             when 'class 12' then 'Class 12'
             when 'grade 11'    then 'Class 11'
             when 'grade eleven' then 'Class 11'
             -- College years. Owner ruling 2026-09-18: bare 1/2/3 are COLLEGE
             -- years, not Class 1/2/3. See the header.
             when '1' then 'College 1st Year'
             when '2' then 'College 2nd Year'
             when '3' then 'College 3rd Year'
             when '4' then 'College 4th Year'
             when 'college 1st year' then 'College 1st Year'
             when 'college 2nd year' then 'College 2nd Year'
             when 'college 3rd year' then 'College 3rd Year'
             when 'college 4th year' then 'College 4th Year'
             when 'first year' then 'College 1st Year'
             -- Everything else keeps the member's own words, trimmed.
             else trim(m.class_grade)
           end::text as cohort
      from public.members m
     where m.status = 'active'
       and m.class_grade is not null
       and trim(m.class_grade) <> ''
  )
  select n.cohort, count(*) as member_count
    from normalised n
   group by n.cohort
   -- Biggest cohort first, then alphabetical, so the page has a stable order
   -- rather than one that reshuffles as members join.
   order by count(*) desc, n.cohort
$$;

comment on function public.class_cohort_counts() is
  'Per-cohort active-member tallies for the public /classes page, with the '
  'free-text members.class_grade normalised to canonical labels for DISPLAY '
  'only - no member row is rewritten. Returns aggregates, never an identifying '
  'row, so /classes needs no anon column grant on class_grade. Bare 1/2/3 are '
  'read as College years per the owner ruling of 2026-09-18. Unrecognised '
  'values pass through as typed. Audit 2026-09-17, scraping P1.';

revoke all on function public.class_cohort_counts() from public;
grant execute on function public.class_cohort_counts() to anon, authenticated;

-- ============================================================================
-- VERIFY
-- ============================================================================
-- Expect the split cohorts merged: one 'Class 11' row near 294, one 'Class 12'
-- near 157, one 'Class 10' near 119, one 'Class 9' near 109, and
-- 'College 1st Year' near 131. Previously these were 9 separate rows.
--
--   select * from public.class_cohort_counts();
--
-- Sanity: the total must not change, because this only regroups.
--   select sum(member_count) from public.class_cohort_counts();
--   select count(*) from public.members
--    where status = 'active' and class_grade is not null and trim(class_grade) <> '';
--   -- the two numbers must match exactly.

-- ============================================================================
-- ROLLBACK: restore the raw, un-normalised grouping
-- ============================================================================
--
-- create or replace function public.class_cohort_counts()
-- returns table (cohort text, member_count bigint)
-- language sql stable security definer set search_path = public
-- as $$
--   select trim(m.class_grade)::text as cohort, count(*) as member_count
--     from public.members m
--    where m.status = 'active' and m.class_grade is not null
--      and trim(m.class_grade) <> ''
--    group by trim(m.class_grade)
--    order by count(*) desc, trim(m.class_grade)
-- $$;
