CREATE TABLE IF NOT EXISTS sweep_jobs (
  job_id TEXT PRIMARY KEY,
  login TEXT NOT NULL,
  total INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS sweep_items (
  job_id TEXT NOT NULL,
  full_name TEXT NOT NULL,
  owner TEXT NOT NULL,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  error TEXT,
  PRIMARY KEY (job_id, full_name)
);

CREATE INDEX IF NOT EXISTS idx_sweep_jobs_login ON sweep_jobs (login, created_at);
CREATE INDEX IF NOT EXISTS idx_sweep_items_status ON sweep_items (job_id, status);
