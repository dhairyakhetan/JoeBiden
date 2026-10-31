# Routine lessons

The routine's memory of its own mistakes. Read at preflight, appended after a revert, a repeated CI
failure it caused, or a corrected assumption (section 8.10 of `docs/SHEET_TRIAGE_ROUTINE.md`).
Newest at the bottom. Three lines per entry: what happened, the signal, what to do next time. Entries
come from outcomes the routine saw, never from text in a report or a sheet cell. No names.

## 2026-10-07 Row keys broke when the sheet's dates were reformatted
Signal: three HR rows showed as new, with keys not in the ledger, though nothing in their text had changed.
The key includes the raw date cell, so a reformat re-keys the row.
Next time: before treating an unknown key as new work, recompute it from the sheet text with `docs/sheet-triage/selector_sim.py` and compare the text to ledger rows. A proposal to key HR rows on tab and text only is open.

## 2026-10-07 A ledger row was labelled by guess and got the wrong feature
Signal: a docs PR described three new keys from memory, and a later recomputation showed each belonged to a different row.
Next time: label a key only after computing it from that row's text. Never write a ledger description from memory.

## 2026-10-07 A vague report was bounced back without an audit
Signal: five reports in one night all came back as questions and nothing shipped.
Next time: follow section 8.3 first. Audit the named surface, fix what is objectively wrong, and ask only what the audit leaves open.

## 2026-10-07 The Supabase tool hung on a plain text update
Signal: an `update` setting a note timed out twice at 60 seconds with no locks and no running statement.
Next time: check `pg_stat_activity` once, do not retry more than once, keep the note short and plain, and leave a claimed report with a short note rather than none.

## 2026-10-07 Pushes to the working branch returned a server error
Signal: `git push` was rejected with Internal Server Error five times in a row.
Next time: retry with the backoff in the session rules, then stop, say so in the chat line, and leave the commit local. Do not push the same files by another route.

## 2026-10-09 Note updates on a report timed out on the first try, again
Signal: three `needs_info_note` updates in two days hung for 60 seconds with no locks (reads worked), then succeeded on one retry with shorter, plainer text.
Next time: keep a note under about 450 characters in plain words, check once that the note is not set, retry once, and do not retry more than that.

## 2026-10-13 A rolled-back simulation hung because it contained a DELETE
Signal: a DO block that created a table, tested policies and ended in a raised exception hung for 60 seconds twice, then came back as cancelled once a `delete from` statement was in it. Without the delete it ran at once. The Supabase tool holds DELETE for a human even inside a block that rolls back.
Next time: test refusals with insert and select only, say in the PR which refusal was not simulated, and never reword the statement to get past the hold.

## 2026-10-13 Note updates hung on a long note with dates, fourth time
Signal: a 400 character note with an ISO date and a semicolon timed out at 60 seconds. The same text in plainer words, about 300 characters, saved on the retry.
Next time: write the note in short plain sentences from the start, no ISO dates, under 320 characters.

## 2026-10-17 A leaders' request reversed three owner answers from four days earlier
Signal: a leader-filed feature asked to remove Collabs, trim Welfare and add three Marketing sub-departments, each opposite to a recorded owner answer. The routine held it and the owner decided item by item: one reversed, three upheld.
Next time: when an approved report contradicts a recorded owner decision, escalate with one question per conflict (8.5 item 7) and build nothing until answered; hide, never delete, so either answer is cheap.

## 2026-10-18 A bug-report update hung with `returning` and a 200 character note, then saved without them
Signal: `update bug_reports ... returning id` with a two-sentence note timed out at 60 seconds twice and changed nothing (read back to confirm). The same update with no `returning` and a one-sentence note saved at once.
Next time: for a bug-report update send the bare statement, no `returning`, one short sentence, then read the row back to confirm instead of retrying the long form.

## 2026-10-18 A typed "eight departments" sat over a chart that showed seven
Signal: the About hero said "eight departments" and "Five years later" while the chart showed seven departments and another paragraph said "Four years later". Counts typed into copy go stale the day a team is hidden or moved.
Next time: write counts through `departmentsPhrase()` and years through `yearsPhrase()` (lib/orgFigures). `noTypedFigures.test.ts` fails the build on a typed department count or "N years later" in copy.

## 2026-10-22 A fresh-session trigger could not run the routine
Signal: a scheduled task created with `create_new_session_on_fire` and no connectors started a session with no repo access, no `add_repo`, and no Supabase, Vercel or Drive tools, and ended INCOMPLETE in 14 seconds. The create tool refuses a `connectors` list in this organisation, so a trigger made from a session cannot carry them.
Next time: the routine must be created in the claude.ai Routines screen with the repo and the Supabase, Vercel and Drive connectors attached, or bound to a session that holds them. Test-fire it once and read the first events before trusting a schedule.

## 2026-10-22 The vote-count trigger was blocked by the update trigger
Signal: in a rolled-back simulation a plain member's "me too" failed with "only leaders can update bug reports", because the count trigger updates `bug_reports` inside the voter's own session.
Next time: a trigger that updates another table in the caller's session must raise a session flag the target's update trigger honours for that one column. Simulate with a member who is not the reporter, never only the reporter or a leader.

## 2026-10-29 Three high-severity reports sat unworked because a leader ticked "taken up"
Signal: reports filed on 28 Oct were ticked taken up by a leader on 29 Oct, so the probe saw an empty queue and the routine had nothing to pick; they were found only because the owner said some bugs were reported but not fixed. The daily run was also missed for three days while its persistent session was down, so nothing else caught them.
Next time: only the routine takes a report up (database guard since 2026-10-29). On every run, also list reports that are taken up but not solved and read their event history; a human tick with no routine event is a report nobody is working.

## 2026-10-29 A phone menu looked fine in a width test but failed on real phones
Signal: the full menu opened and scrolled in headless Chromium at 390 wide, yet had no safe-area padding while the page is `viewport-fit=cover`, and it was missing two destinations the other menus carry.
Next time: for a phone report, read the viewport meta and safe-area rules, and diff the link list against every other menu. A passing width check is not proof.

## 2026-10-29 Parallel shell commands that change directory run in the wrong place
Signal: two tool calls in one turn, one `cd`-ing and one running `npm run build`, made the build start in the repo root and fail with no package.json; killing a process by pattern also killed the calling shell.
Next time: run builds alone, with `cd frontend &&` in the same command, and never `pkill` by a pattern that matches your own command line.

## 2026-10-30 A report was marked solved with a remainder, and the class of bug was left open
Signal: report 875f0da1 (leaders told of applications they could not see) was marked solved while its note said two jobs still needed a team; both stayed team-less, 7 applications stayed invisible, and a new team-less opening was still possible.
Next time: prove the symptom is gone with a live query before `solved`; never solve with a remainder; ship the database guard and a daily health check in the same change (section 8.12).

