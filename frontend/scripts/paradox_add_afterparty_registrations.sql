-- ──────────────────────────────────────────────────────────────────────────
-- Paradox: after-party registrations table
-- ──────────────────────────────────────────────────────────────────────────
-- Run once on the Paradox Supabase project (drvucogrjphctwfealxd) via
-- the SQL editor.
--
-- The after-party is a separate ticketed event from the rest of Paradox —
-- attendees confirm in-person / over WhatsApp and pay phase pricing
-- (early bird 450 / phase 1 550 / phase 2 600 / phase 3 600). Admins
-- add registrations manually as confirmations come in, generate a
-- scannable barcode per registrant for door check-in, and export the
-- list to CSV for the venue.
--
-- Schema design:
--   - ap_id: short human-readable ID ("AP-001") for door scanners +
--     barcode payload. Generated client-side as MAX(...)+1 padded to 3
--     digits at insert time (admin-only insert so contention is fine).
--   - phase: which pricing tier the registrant paid (early_bird / 1/2/3)
--   - paid: defaults true since admins only log confirmed payments
--   - attended: gets flipped at the venue when the barcode is scanned
-- ──────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.paradox_afterparty_registrations (
  id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  ap_id         TEXT         UNIQUE NOT NULL,
  name          TEXT         NOT NULL,
  phone         TEXT         NOT NULL,
  school        TEXT,
  phase         TEXT         DEFAULT 'early_bird'
    CHECK (phase IN ('early_bird','phase_1','phase_2','phase_3')),
  amount        INTEGER,
  paid          BOOLEAN      NOT NULL DEFAULT true,
  attended      BOOLEAN      NOT NULL DEFAULT false,
  notes         TEXT,
  created_by    TEXT,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.paradox_afterparty_registrations IS
  'Manually-logged after-party attendees. Admins add rows in /paradox/admin → After Party tab as confirmations come in over WhatsApp / in person.';

COMMENT ON COLUMN public.paradox_afterparty_registrations.ap_id IS
  'Short ID printed on the barcode (e.g. "AP-001"). Door scanner reads this string. Generated client-side; uniqueness enforced by the UNIQUE constraint.';

-- updated_at trigger so audits stay honest
CREATE OR REPLACE FUNCTION public.set_afterparty_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_afterparty_set_updated_at ON public.paradox_afterparty_registrations;
CREATE TRIGGER trg_afterparty_set_updated_at
  BEFORE UPDATE ON public.paradox_afterparty_registrations
  FOR EACH ROW EXECUTE FUNCTION public.set_afterparty_updated_at();

-- Index for the "show me everything ordered newest first" admin view
CREATE INDEX IF NOT EXISTS idx_paradox_afterparty_created_at
  ON public.paradox_afterparty_registrations (created_at DESC);

-- ──────────────────────────────────────────────────────────────────────────
-- RLS — admins (any authenticated user on this Paradox project) get full
-- access. This table is admin-only; there's no public read surface and
-- no public form pointing here. The Paradox project's auth-users are
-- admins by definition, so authenticated == admin.
-- ──────────────────────────────────────────────────────────────────────────
ALTER TABLE public.paradox_afterparty_registrations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins read afterparty"   ON public.paradox_afterparty_registrations;
DROP POLICY IF EXISTS "Admins write afterparty"  ON public.paradox_afterparty_registrations;
DROP POLICY IF EXISTS "Admins update afterparty" ON public.paradox_afterparty_registrations;
DROP POLICY IF EXISTS "Admins delete afterparty" ON public.paradox_afterparty_registrations;

CREATE POLICY "Admins read afterparty"
  ON public.paradox_afterparty_registrations FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Admins write afterparty"
  ON public.paradox_afterparty_registrations FOR INSERT
  TO authenticated WITH CHECK (true);

CREATE POLICY "Admins update afterparty"
  ON public.paradox_afterparty_registrations FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Admins delete afterparty"
  ON public.paradox_afterparty_registrations FOR DELETE
  TO authenticated USING (true);

-- ──────────────────────────────────────────────────────────────────────────
-- Seed editable thank-you message template — admins can change it later
-- in the After Party tab. {name} / {ap_id} / {phase} / {amount} are
-- replaced client-side at copy time.
-- ──────────────────────────────────────────────────────────────────────────
INSERT INTO public.paradox_site_settings (key, value, updated_at)
VALUES (
  'afterparty_thankyou_msg',
'Hi {name}! 🎉 Your Paradox 2026 After Party ticket is confirmed.

★ Ticket ID: {ap_id}
★ Phase: {phase} · ₹{amount}

Show the barcode at the door — 60, Chowringhee Banquets, 6th June, 5pm.

See you there!
— Team Paradox',
  NOW()
)
ON CONFLICT (key) DO NOTHING;

-- Verify
SELECT column_name, data_type, is_nullable
  FROM information_schema.columns
 WHERE table_schema = 'public'
   AND table_name = 'paradox_afterparty_registrations'
 ORDER BY ordinal_position;
