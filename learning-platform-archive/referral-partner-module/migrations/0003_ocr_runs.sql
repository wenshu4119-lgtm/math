CREATE TABLE ocr_runs (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizations(id),
  upload_id TEXT NOT NULL REFERENCES uploads(id) ON DELETE CASCADE,
  student_id TEXT NOT NULL REFERENCES users(id),
  requested_by TEXT NOT NULL REFERENCES users(id),
  request_id TEXT NOT NULL,
  language TEXT NOT NULL CHECK(language IN ('eng','chi_sim+eng')),
  status TEXT NOT NULL CHECK(status IN ('running','needs_review','teacher_confirmed','failed')),
  provider_json TEXT NOT NULL,
  image_digest TEXT NOT NULL,
  raw_text TEXT,
  confidence REAL,
  elapsed_ms INTEGER,
  error_code TEXT,
  reviewed_text TEXT,
  reviewed_by TEXT REFERENCES users(id),
  reviewed_at TEXT,
  revision INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  completed_at TEXT,
  UNIQUE(upload_id,requested_by,request_id)
);
CREATE UNIQUE INDEX ocr_one_running_upload ON ocr_runs(upload_id) WHERE status='running';
CREATE INDEX ocr_upload_created ON ocr_runs(upload_id,created_at);
ALTER TABLE paper_assessments ADD COLUMN ocr_run_id TEXT REFERENCES ocr_runs(id) ON DELETE SET NULL;
ALTER TABLE paper_assessments ADD COLUMN ocr_provenance_json TEXT;
