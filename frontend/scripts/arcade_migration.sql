-- AQ Arcade — schema + RLS
-- Apply to: Community DB (hzowuwffjqtgszecngpe)
-- Run once in the Supabase SQL editor.

CREATE TABLE IF NOT EXISTS arcade_scores (
  id          UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  member_uuid UUID NOT NULL REFERENCES members(uuid) ON DELETE CASCADE,
  game_id     TEXT NOT NULL CHECK (game_id IN ('typer','reaction','trivia','stack')),
  score       INTEGER NOT NULL CHECK (score >= 0),
  played_at   TIMESTAMPTZ DEFAULT NOW(),
  metadata    JSONB DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_arcade_scores_member  ON arcade_scores(member_uuid);
CREATE INDEX IF NOT EXISTS idx_arcade_scores_game    ON arcade_scores(game_id);
CREATE INDEX IF NOT EXISTS idx_arcade_scores_rank    ON arcade_scores(game_id, score DESC);
CREATE INDEX IF NOT EXISTS idx_arcade_scores_played  ON arcade_scores(played_at DESC);

ALTER TABLE arcade_scores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "arcade_scores_read"        ON arcade_scores;
DROP POLICY IF EXISTS "arcade_scores_insert_own"  ON arcade_scores;

CREATE POLICY "arcade_scores_read"
  ON arcade_scores FOR SELECT
  TO authenticated USING (TRUE);

CREATE POLICY "arcade_scores_insert_own"
  ON arcade_scores FOR INSERT
  TO authenticated
  WITH CHECK (
    member_uuid = (SELECT uuid FROM members WHERE uuid = auth.uid()::uuid LIMIT 1)
  );

-- ── Trivia questions ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS arcade_trivia_questions (
  id         UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  question   TEXT NOT NULL,
  option_a   TEXT NOT NULL,
  option_b   TEXT NOT NULL,
  option_c   TEXT NOT NULL,
  option_d   TEXT NOT NULL,
  answer     TEXT NOT NULL CHECK (answer IN ('a','b','c','d')),
  category   TEXT DEFAULT 'general',
  is_active  BOOLEAN DEFAULT TRUE,
  created_by UUID REFERENCES members(uuid),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE arcade_trivia_questions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "trivia_read_active"  ON arcade_trivia_questions;
DROP POLICY IF EXISTS "trivia_admin_write"  ON arcade_trivia_questions;

CREATE POLICY "trivia_read_active"
  ON arcade_trivia_questions FOR SELECT
  TO authenticated USING (is_active = TRUE);

CREATE POLICY "trivia_admin_write"
  ON arcade_trivia_questions FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM members
      WHERE uuid = auth.uid()::uuid AND role = 'super_admin'
    )
  );

-- ── Seed: 30 trivia questions ────────────────────────────────────

INSERT INTO arcade_trivia_questions (question, option_a, option_b, option_c, option_d, answer, category) VALUES
  ('AquaTerra was founded in which year?','2021','2019','2022','2020','a','history'),
  ('From which city does AquaTerra operate?','Mumbai','Delhi','Kolkata','Bangalore','c','general'),
  ('What is the name of AquaTerra''s annual festival?','AQFest','Paradox','TechKolkata','KolCon','b','events'),
  ('100% of Paradox profits go towards:','Venue upgrades','Marketing','Staff salaries','Animal welfare & community work','d','events'),
  ('AquaTerra''s frontend framework is:','React','Vue','Angular','Svelte','a','tech'),
  ('Which database service powers the AQ platform?','Firebase','Supabase','MongoDB','Neon','b','tech'),
  ('AquaTerra''s design accent color is best described as:','Deep blue','Warm amber','Mint green','Coral red','c','design'),
  ('Which team focuses on environmental and welfare work?','Tech team','Events team','Welfare team','Content team','c','teams'),
  ('AQ Arcade''s Type Racer draws passages from:','Wikipedia','AQ blog & projects','Classic literature','Random websites','b','tech'),
  ('AquaTerra is described as:','A corporate startup','A student community','A government body','A sports club','b','general'),
  ('The AQ Type Racer scores you on:','Raw WPM only','WPM × accuracy','Words typed','Errors made','b','tech'),
  ('Stack It gives you how many lives?','1','2','3','5','c','games'),
  ('AQ Trivia''s max possible score is:','100','110','120','130','d','games'),
  ('How many points does a correct trivia answer give?','5','8','10','15','c','games'),
  ('Speed bonus in trivia is earned when you answer in under:','3 seconds','5 seconds','8 seconds','10 seconds','b','games'),
  ('Reaction Grid is a grid of how many tiles?','9','12','16','20','c','games'),
  ('The Reaction Grid starting window is:','500ms','700ms','900ms','1200ms','c','games'),
  ('AquaTerra''s secondary font used for body text is:','Helvetica','Eina','Roboto','Poppins','b','design'),
  ('AquaTerra''s monospace font is:','Source Code Pro','Fira Code','IBM Plex Mono','JetBrains Mono','c','design'),
  ('Display headings on AQ use:','Playfair Display','Instrument Serif','Garamond','Georgia','b','design'),
  ('Which Supabase project holds the community data?','hzowuwff','drvucogr','nurtpdbq','None of these','a','tech'),
  ('The Paradox after-party feature is called:','Check-in mode','After-party pass','Gate scanner','Ticket verify','a','tech'),
  ('What does pressing Shift+L three times in the footer do?','Nothing','Logs you out','Opens the hidden login','Changes theme','c','tech'),
  ('AquaTerra''s welfare projects are stored in which Supabase project?','hzowuwff','drvucogr','nurtpdbq','They are local only','c','tech'),
  ('The AQ feed supports which type of content?','Posts only','Posts + documents','Videos only','Images only','b','features'),
  ('Global search on AQ is triggered with:','Ctrl+F','Ctrl+K or Cmd+K','Ctrl+S','Alt+S','b','features'),
  ('The AQ Arcade is accessible at which route?','/games','/arcade','/play','/aq-games','b','features'),
  ('AquaTerra''s mission emphasises:','Radical transparency','Maximum profit','Exclusive membership','Celebrity endorsements','a','general'),
  ('The Reaction Grid window shrinks by how many ms per tap?','10ms','20ms','30ms','50ms','b','games'),
  ('Stack It bonus points for a perfect drop:','+1','+2','+3','+5','b','games')
ON CONFLICT DO NOTHING;
