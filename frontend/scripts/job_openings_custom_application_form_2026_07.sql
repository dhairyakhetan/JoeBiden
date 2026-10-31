-- ──────────────────────────────────────────────────────────────────────────
-- ALREADY APPLIED to the live community project (2026-07) via the Supabase
-- MCP connector — this file is kept as a record, not something left to run.
--
-- Two migrations, applied in this order:
--
-- 1. create_job_applications_table
--    job_applications was referenced throughout frontend/src/lib/jobOpenings.ts
--    (apply, hasApplied, getApplications, updateApplicationStatus) but never
--    actually existed as a table in this project — every "apply for a role"
--    click had been failing silently since the feature was built. Created it
--    shaped to match what the frontend already sends/reads, with narrower RLS
--    than job_openings' blanket "any authenticated user" model since
--    applications carry personal contact info and uploaded files:
--      - INSERT: any authenticated member (applying for a role)
--      - SELECT: the applicant themselves, or director/hod/super_admin
--      - UPDATE: director/hod/super_admin only (review-status changes)
--
-- 2. add_job_openings_custom_questions
--    Lets a HoD attach custom questions to an opening (short text, long
--    text, or a file upload) which applicants answer inline on the Apply
--    form, landing in job_applications.custom_answers keyed by question id.
--
-- custom_questions shape (array, on job_openings):
--   [{ "id": "uuid", "label": "Why this role?", "type": "text" | "textarea" | "file", "required": true }]
-- custom_answers shape (object, on job_applications):
--   { "<question id>": "answer text" | "<uploaded file URL>" }
-- File answers are uploaded through the existing `post-documents` storage
-- bucket (same authenticated-write / public-read policy every post
-- attachment already uses) — the column only stores the resulting URL.
-- ──────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.job_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opening_id UUID NOT NULL REFERENCES public.job_openings(id) ON DELETE CASCADE,
  applicant_id INTEGER NOT NULL REFERENCES public.members(member_id) ON DELETE CASCADE,
  applicant_name TEXT NOT NULL,
  applicant_email TEXT NOT NULL,
  message TEXT,
  custom_answers JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'accepted', 'rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (opening_id, applicant_id)
);

CREATE INDEX IF NOT EXISTS idx_job_applications_opening ON public.job_applications(opening_id);
CREATE INDEX IF NOT EXISTS idx_job_applications_applicant ON public.job_applications(applicant_id);

ALTER TABLE public.job_applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "job_applications_auth_insert" ON public.job_applications
  FOR INSERT
  WITH CHECK ((SELECT auth.role()) = 'authenticated');

CREATE POLICY "job_applications_select" ON public.job_applications
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.members
      WHERE members.auth_uid = (SELECT auth.uid())
        AND (
          members.member_id = job_applications.applicant_id
          OR members.role IN ('director', 'hod', 'super_admin')
        )
    )
  );

CREATE POLICY "job_applications_update_status" ON public.job_applications
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.members
      WHERE members.auth_uid = (SELECT auth.uid())
        AND members.role IN ('director', 'hod', 'super_admin')
    )
  );

ALTER TABLE public.job_openings
  ADD COLUMN IF NOT EXISTS custom_questions JSONB NOT NULL DEFAULT '[]'::jsonb;
