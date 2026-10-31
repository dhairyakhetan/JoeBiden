-- ──────────────────────────────────────────────────────────────────────────
-- job_openings — allow director/super_admin to delete (soft-delete transition)
--
-- Symptom: clicking "Delete" on a job opening in the HoD desk (Hiring /
-- ProjectManager-adjacent flows via frontend/src/lib/jobOpenings.ts) throws
-- "new row violates row-level security policy for table job_openings".
--
-- Root cause: `jobOpenings.delete_()` is NOT a hard DELETE — it's a soft
-- transition (`jobOpenings.transition()`, frontend/src/lib/jobOpenings.ts:262)
-- that UPDATEs the row to `status = 'deleted', deleted_at = now()`. The error
-- message ("new row violates...") is Postgres's WITH CHECK failure wording
-- for INSERT/UPDATE, not a DELETE failure — meaning the existing UPDATE
-- policy's WITH CHECK clause doesn't permit a row landing in `status =
-- 'deleted'`, even though the same client/policy already allows other
-- transitions (pause/resume/open) via the identical code path.
--
-- Unlike `welfare_projects` (frontend/scripts/welfare_projects_allow_admin_write_2026_07.sql),
-- job_openings is queried through `supabaseCommunity`, which DOES hold a real
-- authenticated Supabase Auth session — so this policy is gated on actual
-- role via the existing `is_director()` / `is_super_admin()` helpers
-- (frontend/scripts/security_hardening_2026_05_18.sql), not opened to the
-- anon key like the CMS client's tables are.
--
-- Idempotent (DROP IF EXISTS + CREATE) — safe to re-run.
-- ──────────────────────────────────────────────────────────────────────────

ALTER TABLE public.job_openings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "job_openings_director_update" ON public.job_openings;
CREATE POLICY "job_openings_director_update" ON public.job_openings
  FOR UPDATE
  USING (public.is_director() OR public.is_super_admin())
  WITH CHECK (public.is_director() OR public.is_super_admin());

-- Also cover a genuine hard DELETE, in case a future change moves off the
-- soft-delete pattern — costs nothing today since nothing calls it yet.
DROP POLICY IF EXISTS "job_openings_director_delete" ON public.job_openings;
CREATE POLICY "job_openings_director_delete" ON public.job_openings
  FOR DELETE
  USING (public.is_director() OR public.is_super_admin());
