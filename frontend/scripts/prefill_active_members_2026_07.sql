-- ============================================================================
-- prefill_active_members_2026_07.sql
--
-- Pre-creates `members` rows (status='active', auth_uid=NULL) for the emails
-- below, so their first Google sign-in claims this row instead of going
-- through pending_approval. Relies on the live claim-on-login trigger
-- matching by email and attaching auth_uid on first login (per prior batches
-- of ~1000 emails done the same way) — the version of handle_new_user()
-- checked into this repo (community_auth_member_bootstrap_2026_06.sql) only
-- shows an `on conflict (auth_uid) do nothing` insert, not an email-claim
-- upsert, so the live function has evidently been updated since without a
-- corresponding checked-in copy. If a sign-in still lands on /pending instead
-- of skipping straight in, that trigger is the first place to check.
--
-- full_name is NOT NULL with no default — using the email's local-part as a
-- placeholder (same fallback the trigger itself uses), on the assumption the
-- claim step will overwrite it with the real Google display name.
--
-- Safe to re-run: ON CONFLICT (email) DO NOTHING, won't clobber a row that
-- already exists (e.g. if one of these already signed up separately).
-- ============================================================================

INSERT INTO public.members (email, full_name, status, role, created_at)
VALUES
  ('aadyajain12347@gmail.com',        split_part('aadyajain12347@gmail.com', '@', 1),        'active', 'member', now()),
  ('agarwal.bhavishya2008@gmail.com', split_part('agarwal.bhavishya2008@gmail.com', '@', 1), 'active', 'member', now())
ON CONFLICT (email) DO NOTHING;
