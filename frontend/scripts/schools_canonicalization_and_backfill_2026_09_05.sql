-- ============================================================================
-- AquaTerra — schools canonicalization + members.school_id backfill, 2026-09-05
--
-- STATUS: APPLIED + VERIFIED live 2026-09-06 (via Supabase MCP, project
--         hzowuwffjqtgszecngpe), across three migrations:
--           1. schools_canonicalization_2026_09_05        (this file's DDL/DML)
--           2. schools_canonicalization_2026_09_05_fix_stray_row
--              (deleted one accidentally-duplicated row, see below)
--           3. an ephemeral staging-table UPDATE for the members.school_id
--              backfill, executed directly via execute_sql — NOT reproduced
--              in this file (see "THE BACKFILL ITSELF" below for why).
--         Fresh verification queries and their real results are at the
--         bottom of this file, per CLAUDE.md's "verify the live schema, not
--         the .sql files" rule — this project has been burned by trusting a
--         checked-in file's status comment over live reality more than once.
--
-- WHAT THIS IS
-- `public.schools` existed live with the right columns (school_id, uuid,
-- name, short_name, logo_url, location, website, created_at, updated_at —
-- confirmed against information_schema.columns before writing anything) but
-- had 0 rows. `members.school_id` is a FK into it, also all-NULL. This was
-- deliberately skipped by the same-day (2026-09-05) email-matched null-fill
-- reconciliation of other members fields from the four HR workbooks, because
-- the school column in those workbooks is free text with hundreds of
-- spelling/abbreviation variants of the same real institutions — a blind
-- 1:1 insert of every distinct string would have produced hundreds of
-- duplicate "schools" rows. This migration is that skipped piece.
--
-- SOURCES: the SCHOOL/COLLEGE free-text column in COMMUNITY AQUATERRA.xlsx
-- (Sheet1: 1,955 rows, 1,686 non-blank school values, 766 distinct raw
-- strings) and the SCHOOL column across all 10 department tabs of
-- Cross Departmental Database.xlsx (95 more non-blank school values). Both
-- files are gitignored (real member PII) and were read locally, never
-- committed. Matching to members is BY EMAIL ONLY (case-insensitive,
-- trimmed) — this repo's established convention from the same-day
-- reconciliation pass — never by name, and never by phone (phone is the
-- join key for the separate, unrelated aq_contacts archive import from
-- 2026-09-02 — a different feature with a different, deliberate, documented
-- reason for using phone; this task's brief explicitly calls for email-only
-- here and that is what was implemented).
--
-- ── CANONICALIZATION METHOD ─────────────────────────────────────────────────
-- 1. Normalized every raw school string: lowercase, strip periods/commas/
--    hyphens, collapse whitespace. This alone collapsed 766 raw strings
--    (COMMUNITY AQUATERRA) plus the Cross-Departmental values into 450
--    distinct normalized keys.
-- 2. Frequency-ranked the 450 keys (Zipfian, as expected: the top ~110 keys
--    with count >= 2 cover 1,372 of 1,781 total school-bearing rows, ~77%)
--    and manually reasoned about every key down to count=2, plus scanned the
--    full long tail for recognizable abbreviations (e.g. "LMG"/"LMB" -> La
--    Martiniere for Girls/Boys, "DBPC" -> Don Bosco Park Circus, "SBGS" ->
--    Sushila Birla Girls' School, "BESC" -> The Bhawanipur Education Society
--    College, "MBWA"/"MBSV" -> the two separate Mahadevi Birla schools,
--    "JDBI" -> JD Birla Institute). This produced ~85 explicit merge
--    clusters covering the large majority of rows.
-- 3. Campus-distinct chains were kept SEPARATE, never merged into each
--    other, exactly per the task's own DPS example: Delhi Public School
--    (Newtown / Megacity / Ruby Park / Joka — 4 real distinct campuses),
--    Don Bosco School (Park Circus / Liluah), Loreto (House / Convent
--    Entally / College / Day School Elliot Road / Day School Bowbazar — 5
--    distinct real institutions), Apeejay School (Salt Lake / Park Street),
--    Our Lady Queen of the Missions School (Park Circus / Salt Lake),
--    St. Xavier's (College / Collegiate School / University — three
--    genuinely different Kolkata institutions sharing a brand name), Shri
--    Shikshayatan (School / College), Birla-family schools (Birla High
--    School, Mahadevi Birla World Academy, Mahadevi Birla Shishu Vihar,
--    Sushila Birla Girls' School, G.D. Birla Centre for Education, JD Birla
--    Institute — six separate real institutions, not variants of one).
-- 4. Genuinely ambiguous bare/unqualified mentions (e.g. plain "St Xavier's"
--    with no campus named, plain "Narayana" with no branch named) were left
--    as their OWN standalone row, explicitly flagged, never guessed into a
--    specific resolved campus. See "FLAGGED AMBIGUOUS" below for the full
--    list and reasoning — these are real judgment calls a human should be
--    able to review, not silent guesses.
-- 5. Long-tail names (appearing once or twice, no obvious cluster) were
--    inserted as their own row as-is (cosmetic casing cleanup only, no
--    fabricated expansion of e.g. bare acronyms with no corroborating full
--    name elsewhere in the data).
-- 6. A handful of values were EXCLUDED entirely (school_id left NULL, no
--    row created) because they name no real institution: the literal words
--    "School"/"College" typed alone, "not decided yet", "homeschooling",
--    "drop out college", "neet dropper", two long free-text sentences about
--    exam/gap-year status that don't cleanly resolve to one institution, one
--    row that named TWO institutions in the same field ("School - La
--    Martiniere, College - St Xaviers college Autonomous" — can't pick one
--    without guessing), and one row where the SCHOOL column actually
--    contained a stray email address (a data-entry mistake in the source
--    sheet, not a school name).
--
-- RESULT: 766 distinct raw strings (COMMUNITY AQUATERRA alone) + the
-- Cross-Departmental values -> 450 normalized keys -> 212 canonical
-- `schools` rows. See the full build script's output (kept in this
-- session's scratch space, not the repo, since it's a working artifact, not
-- something future readers need — the reasoning that matters is captured in
-- this comment block and the INSERT below) for the complete key-by-key
-- mapping.
--
-- FLAGGED AMBIGUOUS (created as their own standalone row, NOT merged into
-- any specific resolved institution/campus — left for a human to resolve
-- later if more information becomes available):
--   "Our Lady Queen of the Missions School (unspecified campus)" (10 rows) -
--     could be the Park Circus or Salt Lake campus, both attested separately
--   "St Xavier's (unspecified College, Collegiate School, or University)"
--     (4 rows) - three distinct real Kolkata institutions share this name
--   "Narayana" (4 rows) - large multi-branch chain, no branch named
--   "Vibgyor High" (3 rows) - multi-campus chain, no campus named
--   "Don Bosco School" (2 rows) - could be Park Circus or Liluah
--   "Amity Law University Kolkata" (2 rows) - possibly Amity University
--     Kolkata's law school, possibly a separate/miswritten entity
--   "Heritage" (1 row) - the Heritage brand covers 4 distinct institutions
--     in this data (The Heritage School, Heritage Institute of Technology,
--     The Heritage Academy, Heritage Academy High School)
--   "Techno" (1 row) - covers Techno India University and Techno
--     International New Town, no qualifier given
--   "Amity university" (1 row, no campus), "Delhi Public School" (1 row, no
--     campus), "La Martiniere" (1 row - Girls or Boys?), "Manipal Jaipur" /
--     "Manipal institute of technology" / "Manipal Academy of Higher
--     Education" / "Manipal Institute of Technology, Blr" (kept as 4
--     SEPARATE rows - Manipal is a multi-campus/multi-institution system and
--     these may or may not be the same institution), "The doon school" vs
--     "Doon Public School" (kept separate - different, non-interchangeable
--     names), "Bhawanipur Gujarati Education Society College" and
--     "Bhawanipur Global Campus" (kept separate from The Bhawanipur
--     Education Society College - possibly related, not confident enough to
--     merge), "Asutosh Mukherjee College" (kept separate from Asutosh
--     College), "St Thomas Girl's School" (kept separate from "St.Thomas
--     High School"), "St.Helens School" (distinct spelling, standalone),
--     "Delhi World public school (not famous)" (self-described as NOT the
--     well-known DPS - kept as its own entry, not merged into any DPS
--     campus).
-- A wrong merge silently mixes two real schools' members together, which is
-- worse than an untidy duplicate row - every one of the above was a genuine
-- "cannot tell from the text alone" case, not a shortcut.
--
-- ── GRANTS — CHECKED LIVE, NOT ASSUMED ──────────────────────────────────────
-- This project has a documented, JUST-FIXED history (same day, see
-- members_social_grants_fix_2026_09_05.sql) of newly-added members columns
-- silently missing their SELECT grant after the PII lockdown's column-by-
-- column re-grant. Checked before writing anything further, using
-- has_column_privilege()/has_table_privilege() (authoritative per that same
-- incident - information_schema alone was shown to disagree with reality):
--
--   members.school_id predates the PII lockdown and was already correctly
--   re-granted at the time -  confirmed both anon and authenticated hold
--   SELECT, and authenticated holds UPDATE. NO FIX NEEDED.
--
--   public.schools already has the same broad-grant-plus-RLS shape as other
--   reference tables (teams, etc.): table-level grants are broad for
--   anon/authenticated, and RLS narrows actual access -
--   `schools_public_read` (USING true) makes every row SELECT-able by
--   anyone, `schools_director_insert`/`_update` require is_director(),
--   `schools_director_delete` requires is_super_admin(). NO FIX NEEDED.
--
-- The one schema change made here beyond data: a unique index on
-- lower(btrim(name)) (below) - `schoolService.createSchool()` in
-- frontend/src/services/schoolService.ts had no dedupe check on the
-- director-facing "create school" UI, which is exactly the failure mode
-- this whole migration exists to clean up. This prevents it recurring.
--
-- ── THE BACKFILL ITSELF (why it is not reproduced as SQL in this file) ─────
-- members.school_id was set from a staging table of ~1,063 (email, resolved
-- canonical school name) pairs, executed directly against the live database
-- via the Supabase MCP connector in a single transaction (CREATE TEMP TABLE
-- -> INSERT the pairs -> UPDATE members ... FROM the staging table ... WHERE
-- school_id IS NULL -> write one community_audit_logs row per member
-- actually updated -> DROP the staging table -> COMMIT). That staging data
-- is ~1,063 real member email addresses, which is exactly the kind of
-- content this repo's own convention keeps out of git (see the gitignored
-- HR workbooks, and the hr-workbook-pii-in-git-history lesson from an
-- earlier session) - so it is deliberately NOT included here. The schema
-- change (the schools rows and the unique index) is fully reproducible from
-- this file; the row-level member match is reproducible from the four
-- source workbooks plus this file's canonicalization rules, by anyone who
-- has legitimate access to those gitignored workbooks.
-- ============================================================================

-- Prevent future duplicate school rows (the app's own director-facing
-- "create school" flow in schoolService.createSchool() has no dedupe check).
create unique index if not exists schools_name_ci_unique_idx on public.schools (lower(btrim(name)));

insert into public.schools (name)
values
  ('A.J.C. Bose College'),
  ('Abhinav bharti high school'),
  ('Adamas International School'),
  ('Aditya Academy'),
  ('Agrasain Balika Siksha Sadan'),
  ('Agrasain Boys'' School'),
  ('Akshar School'),
  ('Amity Law University Kolkata'),
  ('Amity university'),
  ('Amity University Kolkata'),
  ('Amity University Lucknow Uttar Pradesh'),
  ('Anant national university'),
  ('Apeejay School, Park Street'),
  ('Apeejay School, Salt Lake'),
  ('Ashok Hall Girls'' Higher Secondary School'),
  ('Ashoka University'),
  ('Asian international school'),
  ('Assembly of God Church School, Park Street'),
  ('Asutosh College'),
  ('Asutosh Mukherjee College'),
  ('Atlas skill tech university- Isdi'),
  ('Auxilium Convent School'),
  ('B.D.M.International'),
  ('Bethune college'),
  ('BHarathidasan University'),
  ('Bharatiya Vidya Bhavan'),
  ('Bhavans gangabux kanoria Vidyamandir'),
  ('Bhawanipur Global Campus'),
  ('Bhawanipur Gujarati Education Society College'),
  ('Bihani Academy'),
  ('Birla bharati'),
  ('Birla High School'),
  ('Birla High School, Mukundapur'),
  ('Birla Institute of Technology and Science, Pilani, Pilani campus'),
  ('Bishop george mission school'),
  ('BMSCE'),
  ('Bodhi International'),
  ('Bodhichairya sr sec'),
  ('Bridge International School'),
  ('Bundelkhand University'),
  ('Calcutta boys'' school'),
  ('Calcutta Girls' || chr(8217) || ' High School'),
  ('Calcutta International School'),
  ('Calcutta University'),
  ('Central model school'),
  ('Delhi Public School'),
  ('Delhi Public School, Joka'),
  ('Delhi Public School, Megacity'),
  ('Delhi Public School, Newtown'),
  ('Delhi Public School, Ruby Park'),
  ('Delhi University'),
  ('Delhi World public school (not famous)'),
  ('Devaki memorial school'),
  ('Don Bosco School'),
  ('Don Bosco School, Liluah'),
  ('Don Bosco School, Park Circus'),
  ('Doon Public School'),
  ('Elliot day school'),
  ('Flame university'),
  ('G.D. Birla Centre for Education'),
  ('Garden High School'),
  ('Gd Goenka'),
  ('Gems Akademia International'),
  ('Gokhale memorial girls school'),
  ('Grace ling liang english school'),
  ('Greenwood High ICSE'),
  ('Hariyana Vidya Mandir'),
  ('Harvard House'),
  ('Heritage'),
  ('Heritage Academy High School'),
  ('Heritage Institute of Technology'),
  ('Hindmotor Education centre'),
  ('I P Memorial school'),
  ('IEM (Institute of Engineering and Management)'),
  ('Ignou'),
  ('Igns'),
  ('iLEAD'),
  ('IMS and SUM Hospital Bhubaneshwar Odisha'),
  ('Indian Public School'),
  ('Indus Valley World School'),
  ('International institute of hotel management'),
  ('Jadavpur University'),
  ('Jayashree Ssaraf'),
  ('Jayshree periwal international school'),
  ('JD Birla Institute'),
  ('Jewish Girls'' School'),
  ('JIS college of engineering'),
  ('Jis university'),
  ('Julien Day School'),
  ('Julien Day School, Ganganagar'),
  ('Kalinga institute of industrial technology'),
  ('Karnavati University'),
  ('Karnavati university, gandhinagar'),
  ('Kendriya VidyaLaya'),
  ('Khalsa college, matunga'),
  ('KiiT International School'),
  ('La Martiniere'),
  ('La Martiniere for Boys'),
  ('La Martiniere for Girls'),
  ('Lakshmipat Singhania Academy'),
  ('Loreto College'),
  ('Loreto Convent, Entally'),
  ('Loreto Day School, Bowbazar'),
  ('Loreto Day School, Elliot Road'),
  ('Loreto House'),
  ('Lovely Proffessional University'),
  ('M.C. Kejriwal Vidyapeeth'),
  ('M.P. Birla Foundation Higher Secondary School'),
  ('Mahadevi Birla Shishu Vihar'),
  ('Mahadevi Birla World Academy'),
  ('Maheshwari Girls School'),
  ('Mangalam vidya niketan'),
  ('Manipal Academy of Higher Education'),
  ('Manipal institute of technology'),
  ('Manipal Institute of Technology, Blr'),
  ('Manipal Jaipur'),
  ('Maria''s day school'),
  ('Marwadi Uni ( Guj)'),
  ('Marwadi university'),
  ('Maulana Azad College'),
  ('Maulana Azad College (Passed out)'),
  ('MCKV Institute of Engineering'),
  ('Meghnad saha institute of technology'),
  ('Modern High School for Girls'),
  ('Modern High School International'),
  ('Narayan group of international Schools'),
  ('Narayana'),
  ('Narayana Etechno Park Circus'),
  ('Narayana Newtown'),
  ('Narula institute of technology'),
  ('National high school'),
  ('National institute of fashion technology'),
  ('NMIMS'),
  ('North Point School'),
  ('NSHM KNOWLEDGE CAMPUS KOLKATA'),
  ('Oakridge'),
  ('Orchid international school'),
  ('Our lady queen of the mission Park circus/ modern High school (11-12)'),
  ('Our Lady Queen of the Missions School (unspecified campus)'),
  ('Our Lady Queen of the Missions School, Park Circus'),
  ('Our Lady Queen of the Missions School, Salt Lake'),
  ('PES university'),
  ('Prafulla Chandra College'),
  ('Pratt Memorial School'),
  ('QMS'),
  ('RP Goenka International School'),
  ('Ruby Park Public School'),
  ('S.P.H.S.'),
  ('Saifee Golden Jubilee English Public School'),
  ('Saifee hall'),
  ('Saltlake shiksha niketan'),
  ('School- Good Shepherd International School, Ooty (Graduated)'),
  ('Scottish Church College'),
  ('Seth Anandram Jaipuria College'),
  ('Shri Ram College of Commerce'),
  ('Shri Shikshayatan College'),
  ('Shri Shikshayatan School'),
  ('Sister Nivedita university'),
  ('SK Foundation'),
  ('South City International School'),
  ('South point high school'),
  ('Spring Dale Senior School'),
  ('Sri Sri Academy'),
  ('SRM Institute of Science and Technology'),
  ('SRM KTR'),
  ('St Augustine''s day school'),
  ('St Francis Xavier''s school'),
  ('St Lawrence high school'),
  ('St Stephens'),
  ('St Thomas Girl''s School'),
  ('St Xavier''s (unspecified College, Collegiate School, or University)'),
  ('St. Agnes'' Convent School'),
  ('St. James'' School'),
  ('St. Joan''s School'),
  ('St. John''s Diocesan Girls'' Higher Secondary School'),
  ('St. Paul''s'),
  ('St. Xavier''s College, Kolkata (Autonomous)'),
  ('St. Xavier''s Collegiate School'),
  ('St. Xavier''s University, Kolkata'),
  ('St.Helens School'),
  ('St.Thomas High School'),
  ('St.Xavier'' s Collage'),
  ('STEM WORLD'),
  ('Summer fields school gk 1'),
  ('Sushila Birla Girls'' School'),
  ('SVKM JV PAREKH'),
  ('Swami Vivekananda Institute of Modern Science'),
  ('Symbiosis school of economics'),
  ('Techno'),
  ('Techno India University'),
  ('Techno International New Town'),
  ('The Bhawanipur Education Society College'),
  ('The BSS School'),
  ('The doon school'),
  ('The Frank Anthony Public School'),
  ('The future foundation school'),
  ('The Heritage Academy'),
  ('The Heritage School'),
  ('The Kalyani school pune'),
  ('The Newtown School'),
  ('The Ohio State University'),
  ('THK Jain College, Kolkata(Affiliated to University of Calcutta)'),
  ('Ths'),
  ('UID, karnavati university'),
  ('Umeå University'),
  ('Umeschandra college'),
  ('Vels global school howrah'),
  ('Vibgyor High'),
  ('Vibgyor High Balewadi'),
  ('Vision International School'),
  ('Wilson college'),
  ('Young Horizons School')
on conflict do nothing;

-- ============================================================================
-- CORRECTION applied same day (migration
-- schools_canonicalization_2026_09_05_fix_stray_row): while hand-transcribing
-- the INSERT above into the SQL tool call, "Lady Queens of Mission" was
-- accidentally typed as its own extra row (a transcription slip, not a
-- decision — the canonicalization script's own output correctly clustered
-- it into "Our Lady Queen of the Missions School (unspecified campus)").
-- Live count briefly read 213 instead of the intended 212; caught by
-- diffing the live table against the build script's own output before the
-- backfill ran, so no member ever referenced the stray row. Fixed with:
--   delete from public.schools where name = 'Lady Queens of Mission';
-- Left here as a record of exactly the "trust live data over your own
-- output" discipline CLAUDE.md asks for — the fix was caught by re-querying
-- live, not by re-reading this file.
-- ============================================================================

-- ============================================================================
-- AUDIT TRAIL — same shape as the same-day hr_reconciliation_fill pass
-- (member_id, action='school_backfill', entity_type='member',
-- entity_id=member_id, details jsonb with import_batch/school_id/
-- school_name), one row per member actually updated. Query:
--   select action, count(*) from public.community_audit_logs
--    where action = 'school_backfill' group by action;
-- ============================================================================

-- ============================================================================
-- VERIFICATION — run after applying. Real results from this session, live,
-- 2026-09-06 (re-queried fresh, not copied from the apply step's own return
-- value):
--
--   select count(*) from public.schools;
--   -> 212
--
--   select count(*) from public.members where school_id is not null;
--   -> 1034  (out of 1375 total members)
--
--   select count(*) from public.community_audit_logs where action = 'school_backfill';
--   -> 1034  (matches the members count exactly, as expected: one audit row
--             per member actually updated, and nothing else in this session
--             wrote school_id)
--
--   select has_column_privilege('anon','public.members','school_id','SELECT'),
--          has_column_privilege('authenticated','public.members','school_id','SELECT'),
--          has_table_privilege('anon','public.schools','SELECT'),
--          has_table_privilege('authenticated','public.schools','SELECT');
--   -> true, true, true, true  (all four already correct — no grant fix
--      needed here, unlike members_social_grants_fix_2026_09_05.sql's find)
--
--   select count(*) from information_schema.tables
--    where table_schema='public' and table_name='_school_backfill_stage';
--   -> 0  (the backfill's staging table was dropped as part of its own
--          transaction, confirmed not left behind)
-- ============================================================================
