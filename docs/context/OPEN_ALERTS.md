# Open alerts

The nightly routine pushes a non-green alert once. A check listed here is still shown in the chat line
each night but does not push again until its number changes (`docs/SHEET_TRIAGE_ROUTINE.md`, section 5b).

One line per alert: `check | tripped number | date first pushed`. The routine removes a line when the check
clears. Changes to this file go through a normal PR.

Bug tracker guarantees (H7) | 4 triggers on bug_reports, baseline 3; the extra one is bug_secret_row_trg from the 2026-10-22 tracker migration, expected | 2026-10-23
Security advisors, RLS enabled with no policy | 33, baseline 32; the new table is public.bug_report_secrets, meant to have no client policy, H11 confirms | 2026-10-23
Security advisors, callable by signed-in users | 43, baseline 42; the new function is bug_reporter_confirm, it checks the caller is the reporter or a voter | 2026-10-23
