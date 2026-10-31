-- ============================================================================
-- class_cohort_counts() v2 — complete the /classes normalisation
--
--   STATUS: APPLIED 2026-09-18, VERIFIED LIVE.
--     48 cohort rows -> 14. Total 1,138, identical to count(*) on the table, so
--     the regrouping dropped and double-counted nothing. Zero junk rows: the
--     emoji, the timestamp and the bare years are inside 'Other'.
--       Class 11 337 · Class 12 190 · College 1st Year 159 · Class 10 137
--       Class 9 129 · College 2nd Year 59 · College 3rd Year 37 · Class 8 34
--       Other 23 · Alumni 16 · Class 7 14 · Class 5 1 · Class 6 1
--       College 4th Year 1
--   SUPERSEDES class_cohort_normalise_2026_09_18.sql (v1), which IS applied.
--   This is a `create or replace` of the same function. Run it once; nothing
--   else changes and no member row is touched. Section 3 rolls back to v1.
--
-- WHY A v2
--   v1 was written against a 1,000-row sample and mapped the obvious spellings.
--   Run live against all 1,138 members with a cohort, it grouped 1,087 of them
--   (95.5%) into nine clean cohorts - but left 48 rows, 39 of them with one to
--   three members, on a PUBLIC page. Including, verbatim:
--
--       10💀💀                 1
--       2026-10-01 00:00:00     1
--       2012 / 2022 / 2028      1 each
--       X  /  Xll               1 each     (roman numerals: Class 10, Class 12)
--       1st / 1st year / 12th   1 each
--
--   A timestamp and an emoji were being rendered as student cohorts.
--
-- THE DESIGN CHANGE THAT MATTERS
--   v1 ended `else trim(m.class_grade)`, so anything unrecognised became its own
--   public row - which means the NEXT bad value typed into a profile shows up on
--   /classes immediately. v2 ends `else 'Other'`. Unknown input can no longer
--   reach the page. That is the difference between a fix and a fix that stays
--   fixed.
--
-- OWNER RULINGS RECORDED (2026-09-18)
--   1. Bare '1'/'2'/'3' are COLLEGE years, not Class 1/2/3. (Carried from v1.)
--   2. Clear graduates get their own 'Alumni' row rather than being collapsed
--      into 'Other' with the junk - about 16 people who genuinely are a group.
--
-- STILL DISPLAY ONLY. members.class_grade is not rewritten. The HoD desk,
-- search, CVs and receipts all keep reading the raw column, so nothing else in
-- the app shifts underneath them.
-- ============================================================================

create or replace function public.class_cohort_counts()
returns table (cohort text, member_count bigint)
language sql
stable
security definer
set search_path = public
as $$
  with raw as (
    select lower(trim(m.class_grade)) as v
      from public.members m
     where m.status = 'active'
       and m.class_grade is not null
       and trim(m.class_grade) <> ''
  ),
  mapped as (
    select case
             -- ── School classes ──────────────────────────────────────────
             -- Exact matches only, so '12th pass' does NOT land here and falls
             -- through to the alumni patterns below. Order is load-bearing.
             when v in ('5', 'class 5', 'v')                        then 'Class 5'
             when v in ('6', 'class 6', 'vi')                       then 'Class 6'
             when v in ('7', 'class 7', 'vii', '7th')               then 'Class 7'
             when v in ('8', 'class 8', 'viii', '8th')              then 'Class 8'
             when v in ('9', 'class 9', 'ix', '9th', 'grade 9')     then 'Class 9'
             -- 'x' is the roman numeral, found live as a real member's answer.
             when v in ('10', 'class 10', 'x', '10th', 'grade 10')  then 'Class 10'
             when v in ('11', 'class 11', 'xi', '11th', 'grade 11', 'grade eleven')
                                                                    then 'Class 11'
             -- Written as "Class 11 moving to 12 this year": takes the class
             -- they state they are IN, which is the same rule as everyone else.
             when v like 'class 11 moving%'                         then 'Class 11'
             -- 'xll' is 'xii' typed with lowercase L for I. A real answer.
             when v in ('12', 'class 12', 'xii', 'xll', '12th', 'grade 12')
                                                                    then 'Class 12'

             -- ── College years ───────────────────────────────────────────
             -- BEFORE the alumni patterns, deliberately: "Batch of 2026/ 1st
             -- year" is a first-year, not a graduate, and the word 'batch'
             -- would otherwise pull it the wrong way.
             when v in ('1', '1st', 'first year', 'college 1st year') or v like '%1st year%'
                                                                    then 'College 1st Year'
             when v in ('2', '2nd', 'second year', 'college 2nd year') or v like '%2nd year%'
                                                                    then 'College 2nd Year'
             when v in ('3', '3rd', 'third year', 'college 3rd year') or v like '%3rd year%'
                                                                    then 'College 3rd Year'
             when v in ('4', '4th', 'fourth year', 'college 4th year') or v like '%4th year%'
                                                                    then 'College 4th Year'

             -- ── Alumni ──────────────────────────────────────────────────
             -- Owner ruling 2: these are a real group, not junk, so they get a
             -- named row. Patterns rather than a fixed list, because there are
             -- at least a dozen ways people write this and more will arrive.
             when v like '%pass%out%'   or v like '%passout%'
               or v like 'passed%'      or v like '%graduat%'
               or v like '%completed%'  or v like '%12th pass%'
               or v = 'finished'
                                                                    then 'Alumni'

             -- ── Everything else ─────────────────────────────────────────
             -- THE IMPORTANT LINE. v1 passed unknown values through as their
             -- own public row, which is how an emoji and a timestamp ended up
             -- being displayed as cohorts. Anything unrecognised is now
             -- 'Other', which is the escape hatch /register's own picker
             -- already offers. Nothing is lost: the raw value is still in the
             -- column and still visible to the desk.
             else 'Other'
           end::text as cohort
      from raw
  )
  select m.cohort, count(*) as member_count
    from mapped m
   group by m.cohort
   -- Biggest first, then alphabetical, so the page order is stable as members
   -- join rather than reshuffling on every visit.
   order by count(*) desc, m.cohort
$$;

comment on function public.class_cohort_counts() is
  'Per-cohort active-member tallies for the public /classes page. v2, '
  '2026-09-18. Normalises the free-text members.class_grade to canonical '
  'labels for DISPLAY ONLY - no member row is rewritten. Unknown values map to '
  '"Other" rather than becoming their own public row, which is what previously '
  'let an emoji and a timestamp render as student cohorts. Bare 1/2/3 are read '
  'as College years and clear graduates group as "Alumni", both per the owner '
  'rulings of 2026-09-18. Returns aggregates only, never an identifying row, so '
  '/classes needs no anon column grant on class_grade.';

revoke all on function public.class_cohort_counts() from public;
grant execute on function public.class_cohort_counts() to anon, authenticated;

-- ============================================================================
-- VERIFY
-- ============================================================================
-- 1. Expect roughly 12 rows, not 48, and no emoji, date or bare year among them:
--      select * from public.class_cohort_counts();
--
-- 2. THE ONE THAT MATTERS. This only regroups, so the total must be IDENTICAL
--    to before. Both numbers must be 1138:
--      select sum(member_count) as from_function from public.class_cohort_counts();
--      select count(*)          as from_table
--        from public.members
--       where status = 'active' and class_grade is not null and trim(class_grade) <> '';
--
-- 3. Nothing was written to the member rows. This must still return 63:
--      select count(distinct trim(class_grade)) from public.members
--       where status = 'active' and class_grade is not null and trim(class_grade) <> '';

-- ============================================================================
-- ROLLBACK to v1 (raw pass-through for unknown values)
-- ============================================================================
-- Re-run scripts/class_cohort_normalise_2026_09_18.sql in full.
