-- ─────────────────────────────────────────────────────────────────────────
-- job_applications.rejection_reason (2026-09-08)
-- ─────────────────────────────────────────────────────────────────────────
-- Handoff §20.7: "Rejection needs a reason that reaches the applicant."
-- jobOpenings.updateApplicationStatus() already notifies on reject, but the
-- message was a fixed generic string with nowhere for a director's actual
-- reason to go. This column is that place.
--
-- Verified live (2026-09-08) before writing this: job_applications has no
-- column matching %reason%/%note%/%feedback%, and `authenticated` already
-- holds unrestricted column privileges on every column of this table (no
-- lockdown like `members` - see CLAUDE.md's default-ACL note), so this new
-- column needs no extra grant beyond what the table already carries. Still
-- checking, not assuming - per CLAUDE.md's "verify the live schema" rule.
-- ─────────────────────────────────────────────────────────────────────────

alter table public.job_applications
  add column if not exists rejection_reason text;
