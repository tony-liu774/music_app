-- Practice sessions table — one row per completed practice session
CREATE TABLE IF NOT EXISTS practice_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  score_id TEXT,
  score_title TEXT,
  instrument TEXT NOT NULL DEFAULT 'violin',
  duration_ms INTEGER NOT NULL DEFAULT 0,
  accuracy_percent INTEGER NOT NULL DEFAULT 0,
  total_deviations INTEGER NOT NULL DEFAULT 0,
  pitch_deviation_count INTEGER NOT NULL DEFAULT 0,
  avg_pitch_deviation_cents REAL NOT NULL DEFAULT 0,
  worst_measure INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_practice_sessions_user
  ON practice_sessions(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_practice_sessions_score
  ON practice_sessions(user_id, score_id, created_at DESC);

-- Session errors table — individual deviations logged during a session
CREATE TABLE IF NOT EXISTS session_errors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES practice_sessions(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  measure_number INTEGER,
  beat INTEGER,
  expected_note TEXT,
  detected_note TEXT,
  cents_deviation REAL,
  confidence REAL,
  is_vibrato BOOLEAN DEFAULT FALSE,
  timestamp_ms BIGINT
);

CREATE INDEX IF NOT EXISTS idx_session_errors_session
  ON session_errors(session_id);

-- User pieces table — tracks per-piece progress over time
CREATE TABLE IF NOT EXISTS user_pieces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  score_id TEXT NOT NULL,
  score_title TEXT,
  instrument TEXT NOT NULL DEFAULT 'violin',
  practice_count INTEGER NOT NULL DEFAULT 0,
  best_accuracy INTEGER NOT NULL DEFAULT 0,
  last_accuracy INTEGER NOT NULL DEFAULT 0,
  last_practiced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, score_id)
);

CREATE INDEX IF NOT EXISTS idx_user_pieces_user
  ON user_pieces(user_id, last_practiced_at DESC);

-- Row-level security: users can only access their own data
ALTER TABLE practice_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_errors ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_pieces ENABLE ROW LEVEL SECURITY;

CREATE POLICY practice_sessions_user_policy ON practice_sessions
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY session_errors_user_policy ON session_errors
  FOR ALL USING (
    session_id IN (
      SELECT id FROM practice_sessions WHERE user_id = auth.uid()
    )
  );

CREATE POLICY user_pieces_user_policy ON user_pieces
  FOR ALL USING (auth.uid() = user_id);
