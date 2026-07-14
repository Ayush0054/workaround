CREATE TABLE IF NOT EXISTS ai_verdicts (
  login TEXT NOT NULL,
  full_name TEXT NOT NULL,
  verdict TEXT NOT NULL CHECK (verdict IN ('unstar', 'keep', 'unsure')),
  reason TEXT NOT NULL,
  reviewed_at INTEGER NOT NULL,
  PRIMARY KEY (login, full_name)
);

CREATE INDEX IF NOT EXISTS idx_ai_verdicts_login_reviewed
  ON ai_verdicts (login, reviewed_at DESC);
