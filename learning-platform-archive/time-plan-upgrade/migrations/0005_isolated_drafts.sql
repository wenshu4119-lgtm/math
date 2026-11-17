-- Teacher-owned synthetic source material and isolated candidates only.
-- No foreign key or publication path into questions, knowledge or student evidence.
CREATE TABLE draft_sources (
  id TEXT PRIMARY KEY, org_id TEXT NOT NULL REFERENCES organizations(id),
  owner_id TEXT NOT NULL REFERENCES users(id), request_id TEXT NOT NULL,
  request_hash TEXT NOT NULL, title TEXT NOT NULL,
  subject TEXT NOT NULL CHECK(subject IN ('math','english')),
  source_text TEXT NOT NULL, source_digest TEXT NOT NULL,
  source_label TEXT NOT NULL, license TEXT NOT NULL,
  revision INTEGER NOT NULL DEFAULT 1 CHECK(revision=1),
  synthetic INTEGER NOT NULL DEFAULT 1 CHECK(synthetic=1), created_at TEXT NOT NULL,
  UNIQUE(org_id,owner_id,request_id)
);
CREATE TABLE question_drafts (
  id TEXT PRIMARY KEY, org_id TEXT NOT NULL REFERENCES organizations(id),
  owner_id TEXT NOT NULL REFERENCES users(id), request_id TEXT NOT NULL,
  request_hash TEXT NOT NULL, title TEXT NOT NULL,
  subject TEXT NOT NULL CHECK(subject IN ('math','english')),
  sources_json TEXT NOT NULL, provenance_json TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('generating','pending_human','accepted_isolated','rejected','failed','unavailable')),
  revision INTEGER NOT NULL DEFAULT 1, error_code TEXT,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL, write_token TEXT NOT NULL,
  UNIQUE(org_id,owner_id,request_id)
);
CREATE TABLE draft_versions (
  draft_id TEXT NOT NULL REFERENCES question_drafts(id), revision INTEGER NOT NULL,
  status TEXT NOT NULL, questions_json TEXT NOT NULL, validation_json TEXT NOT NULL,
  review_json TEXT, actor_id TEXT NOT NULL REFERENCES users(id), created_at TEXT NOT NULL,
  PRIMARY KEY(draft_id,revision)
);
CREATE INDEX question_drafts_owner ON question_drafts(org_id,owner_id,created_at);
CREATE INDEX draft_sources_owner ON draft_sources(org_id,owner_id,created_at);
