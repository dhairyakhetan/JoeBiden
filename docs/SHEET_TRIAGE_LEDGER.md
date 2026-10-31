# Sheet triage ledger

Record of the rows from the "AQ WEBSITE TASKS" Google Sheet (file ID
`18zxOT5MLdQv3UxbplWcb7Yc9pPjTnV0TqNdkBLhXqwc`) that the triage work has handled.
The routine's rules are in `docs/SHEET_TRIAGE_ROUTINE.md`.

The routine cannot tick the sheet's checkboxes (the Drive connector can only read
cell values; `update_file` renames or moves files), so **this file is the only
record of progress and the dedupe key store**. A row whose key is listed here is
skipped on later runs, unless its text in the sheet changes (that gives it a new
key). Nobody ticks `VERIFIED` but a human, on the live site.

Key = first 10 hex of `sha1(tab | date | link | text[:80])` after trimming,
collapsing whitespace and lowercasing; see `docs/sheet-triage/selector_sim.py`.
Statuses: `Merged and live`, `Done`, `Partial`, `Already done`,
`Needs clarification`, `Needs human`, `Failed`. A row marked `Needs human` or
`Needs clarification` is skipped until its text changes or a human removes it here.

| Key | Tab | Row | Status | PRs | Date |
| --- | --- | --- | --- | --- | --- |
| `53578ffdee` | BUGS | 01.10.2026, /projects/1018, hero sticker text overflows | Merged and live. Awaiting human VERIFIED. | [#33](https://github.com/kaxx4/vercelaq/pull/33) | 2026-10-02 |
| `dd75c50760` | BUGS | 2.10.2026, /director/member-of-month, HoD of social media cannot pick for her team | Done, a data fix not code: she was `hod` and active but had no roster row, and a HoD picks only for teams they are on. Added member 1434 to Social Media (team 9), `team_members` row 391, live 2026-10-03. Awaiting human VERIFIED. | none | 2026-10-03 |
| `68c93936d5` | BUGS | 2.10.26, /director/member-of-month, cannot pick more than 1 member per team | Merged and live, verified 2026-10-05. Code live in #36 (desk adds picks, team pages show all honorees). Step 2, `alter table public.member_of_the_month drop constraint member_of_the_month_period_team_key;`, was run by the owner in the SQL editor on 2026-10-05 (the Supabase tool holds destructive statements for a human confirmation). Checked afterwards: the old constraint is gone, only the `(period, team_id, member_id)` unique index and the primary key remain, and in a rolled-back run as the Social Media HoD two different members saved for one team and month while the same member twice was refused. (Earlier text said `drop index`; that fails because the old rule is a constraint.) Awaiting human VERIFIED. | [#36](https://github.com/kaxx4/vercelaq/pull/36), [#40](https://github.com/kaxx4/vercelaq/pull/40) | 2026-10-05 |
| `36f180896a` | HR | Make team picture editable by HoDs | Merged and live. A real upload as a HoD is untested. | [#34](https://github.com/kaxx4/vercelaq/pull/34) | 2026-10-02 |
| `909d59bdbb` | HR | Visual hierarchy chart, AquaTerra, Departments, Sub-departments, clickable | Merged and live. The chart already existed on the About page; now every node is clickable and wide screens show every sub-department. | [#38](https://github.com/kaxx4/vercelaq/pull/38) | 2026-10-03 |
| `2f9d29ede6` | HR | Reusable team page template (cover, HoD description, sub-departments, members with HoDs and Directors highlighted, tagged-post feed) | Merged and live. Most pieces already existed; the gaps closed by #34 (cover picture), #37 (tagged-post feed), #38 (leaders highlighted). | [#34](https://github.com/kaxx4/vercelaq/pull/34), [#37](https://github.com/kaxx4/vercelaq/pull/37), [#38](https://github.com/kaxx4/vercelaq/pull/38) | 2026-10-03 |
| `f223d5ec17` | HR | Permanently open roles section | Merged and live. A standing role is an open role with no deadline; the section is always present on team pages and as a band on /opportunities. | [#38](https://github.com/kaxx4/vercelaq/pull/38) | 2026-10-03 |
| `1ff3f37dc1` | HR | "Tag team(s)" on posts, show on team pages, back-tag existing posts | Merged and live. New `post_teams` table; 562 existing posts back-tagged, the `source` column records why (undo with `delete from post_teams where source like 'backfill%'`). Content and operations posts with no named team were left untagged on purpose. | [#37](https://github.com/kaxx4/vercelaq/pull/37) | 2026-10-03 |
| `f552573a61` | HR | Make team picture editable by HoDs (start date reformatted in the sheet, same row as `36f180896a`) | Already done, see `36f180896a`. Sheet status IN PROCESS is stale. | [#34](https://github.com/kaxx4/vercelaq/pull/34) | 2026-10-07 |
| `0a48d98d9f` | HR | Visual hierarchy chart, AquaTerra, Departments, Sub-departments, clickable (start date reformatted in the sheet, same row as `909d59bdbb`) | Already done, see `909d59bdbb`. Sheet status NOT STARTED is stale. | [#38](https://github.com/kaxx4/vercelaq/pull/38) | 2026-10-07 |
| `428c503ae8` | HR | Reusable team page template (start date reformatted in the sheet, same row as `2f9d29ede6`) | Already done, see `2f9d29ede6`. Sheet status NOT STARTED is stale. (PR #49 first labelled these three keys with the wrong rows; corrected 2026-10-07 by recomputing each key from the sheet text.) | [#34](https://github.com/kaxx4/vercelaq/pull/34), [#37](https://github.com/kaxx4/vercelaq/pull/37), [#38](https://github.com/kaxx4/vercelaq/pull/38) | 2026-10-07 |
