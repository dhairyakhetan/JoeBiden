# Plan: let people edit a report's description (bug report e97510b0)

Status: BUILT 2026-10-09. The owner approved this design on 2026-10-09 ("build it as proposed"). The
database part is live (`frontend/scripts/bug_reports_edit_description_2026_10_09.sql`, simulated in
rolled-back blocks: member edit allowed and approval cleared, self-approval refused, edit plus a status
change refused, another member's report unreachable, edits after the routine takes a report refused,
routine edit refused, leader edit allowed with approval kept). The page has an "edit description" action
in the expanded row. Report e97510b0 (HR director, 2026-10-08): "allow people to edit the descriptions of
already uploaded bugs".

## 1. Why a description is locked today

The routine acts on the description of a report a leader approved. If the text could change after the
approval, someone could get a harmless sentence approved and swap in a different one before the routine
reads it. So the database refuses any change to `description` (trigger `private.bug_reports_before_update`:
"the report itself cannot be edited, only its status"), and the UPDATE grant covers status columns only.

## 2. Proposed rule

A report's description may be edited only while it is still waiting, and any edit that could matter to
the routine takes the approval away.

- Who: the reporter, on their own report. A leader may also edit any report that has not been taken up.
- When: only while `taken_up` is false, `solved` is false and `declined_reason` is null. Once the routine
  has claimed it, the text is frozen again, so what it builds is what was approved.
- Approval: if a non-leader edits a report that was approved, `approved_for_fix` and `approved_by` are
  cleared, and a leader approves it again. A leader editing keeps the approval.
- Record: an `edited` event in `bug_report_events` with the previous text (first 900 characters), so
  nothing is lost.
- The routine itself still cannot edit a description.
- Limits unchanged: 10 to 4000 characters.

## 3. Changes (all additive, nothing dropped)

1. `grant update (description) on public.bug_reports to authenticated` (new column grant).
2. A new RLS update policy: reporter on own row, or a leader, for rows that are not taken up, solved or
   declined. The existing leader policy stays.
3. Extend `private.bug_reports_before_update` from its live definition: allow a description change for
   `auth.uid() is not null` sessions under the rules above, clear approval on a non-leader edit, write the
   event; keep refusing every other immutable column and every change from the routine.
4. UI: an "edit" action in the expanded row, visible to the reporter or a leader while the report is open;
   a clear notice "editing removes the approval until a leader approves it again" for a non-leader;
   `ConfirmDialog` is not needed, a toast is.
5. Tests: `bugModel` rule helper plus the rolled-back database simulations for: member edits own open
   report (allowed, approval cleared), member edits someone else's (refused), member edits a taken-up report
   (refused), leader edits (allowed, approval kept), routine edits (refused).

## 4. What is not covered

Editing screenshots, severity or kind (still fixed). Editing after a report is solved (use a new report).

## 5. Decision needed

Tell the owner session (the session this routine runs in) "build edit-own-report", or say which part to
change. A leader can also untick "taken up" on the report on `/bugs` once the owner has decided, which
puts it back in the queue. Until then the description stays locked.
