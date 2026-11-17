PRAGMA foreign_keys = ON;
CREATE TABLE organizations (id TEXT PRIMARY KEY, name TEXT NOT NULL);
CREATE TABLE users (
  id TEXT PRIMARY KEY, org_id TEXT NOT NULL REFERENCES organizations(id),
  username TEXT NOT NULL UNIQUE, display_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('admin','teacher','student','parent')),
  password_hash TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
  created_at TEXT NOT NULL
);
CREATE TABLE relationships (
  id TEXT PRIMARY KEY, org_id TEXT NOT NULL REFERENCES organizations(id),
  adult_id TEXT NOT NULL REFERENCES users(id), student_id TEXT NOT NULL REFERENCES users(id),
  kind TEXT NOT NULL CHECK(kind IN ('teacher','parent')),
  created_by TEXT NOT NULL REFERENCES users(id), created_at TEXT NOT NULL,
  UNIQUE(adult_id,student_id)
);
CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), expires_at INTEGER NOT NULL
);
CREATE INDEX sessions_user ON sessions(user_id);
CREATE TABLE rate_limits (key TEXT PRIMARY KEY, count INTEGER NOT NULL, expires_at INTEGER NOT NULL);
CREATE TABLE knowledge (
  id TEXT PRIMARY KEY, subject TEXT NOT NULL CHECK(subject IN ('math','english')),
  title TEXT NOT NULL, explanation TEXT NOT NULL, memory_card TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1, source TEXT NOT NULL,
  is_example INTEGER NOT NULL DEFAULT 1 CHECK(is_example = 1)
);
CREATE TABLE questions (
  id TEXT PRIMARY KEY, knowledge_id TEXT NOT NULL REFERENCES knowledge(id),
  phase TEXT NOT NULL CHECK(phase IN ('diagnostic','practice','retest')),
  prompt TEXT NOT NULL, options_json TEXT NOT NULL, correct_option INTEGER NOT NULL,
  rationale TEXT NOT NULL, verification TEXT NOT NULL,
  UNIQUE(knowledge_id,phase)
);
-- Review is per organization: a teacher in another organization cannot publish our content.
CREATE TABLE content_reviews (
  org_id TEXT NOT NULL REFERENCES organizations(id), knowledge_id TEXT NOT NULL REFERENCES knowledge(id),
  version INTEGER NOT NULL, reviewed_by TEXT NOT NULL REFERENCES users(id), reviewed_at TEXT NOT NULL,
  PRIMARY KEY(org_id,knowledge_id,version)
);
CREATE TABLE attempts (
  id TEXT PRIMARY KEY, org_id TEXT NOT NULL REFERENCES organizations(id), student_id TEXT NOT NULL REFERENCES users(id),
  subject TEXT NOT NULL CHECK(subject IN ('math','english')), phase TEXT NOT NULL CHECK(phase IN ('diagnostic','practice','retest')),
  pack_id TEXT REFERENCES packs(id), status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','submitted')),
  created_by TEXT NOT NULL REFERENCES users(id), submitted_by TEXT REFERENCES users(id),
  source TEXT CHECK(source IN ('student_self','teacher_recorded')), created_at TEXT NOT NULL, submitted_at TEXT,
  correct INTEGER, total INTEGER, UNIQUE(pack_id,phase)
);
CREATE TABLE attempt_items (
  attempt_id TEXT NOT NULL REFERENCES attempts(id), question_id TEXT NOT NULL REFERENCES questions(id),
  knowledge_id TEXT NOT NULL REFERENCES knowledge(id), position INTEGER NOT NULL,
  snapshot_json TEXT NOT NULL, PRIMARY KEY(attempt_id,question_id)
);
CREATE TABLE answers (
  attempt_id TEXT NOT NULL, question_id TEXT NOT NULL, selected_option INTEGER NOT NULL, is_correct INTEGER NOT NULL CHECK(is_correct IN (0,1)),
  PRIMARY KEY(attempt_id,question_id), FOREIGN KEY(attempt_id,question_id) REFERENCES attempt_items(attempt_id,question_id)
);
CREATE TABLE packs (
  id TEXT PRIMARY KEY, org_id TEXT NOT NULL REFERENCES organizations(id), student_id TEXT NOT NULL REFERENCES users(id),
  diagnostic_id TEXT NOT NULL UNIQUE REFERENCES attempts(id), subject TEXT NOT NULL CHECK(subject IN ('math','english')),
  knowledge_ids_json TEXT NOT NULL, weak_ids_json TEXT NOT NULL, material_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','approved','in_progress','completed')),
  teacher_note TEXT NOT NULL DEFAULT '', revision INTEGER NOT NULL DEFAULT 1,
  algorithm TEXT NOT NULL, reviewed_by TEXT REFERENCES users(id), reviewed_at TEXT, created_at TEXT NOT NULL
);
CREATE INDEX attempts_student ON attempts(student_id,created_at);
CREATE INDEX packs_student ON packs(student_id,created_at);
CREATE TABLE uploads (
  id TEXT PRIMARY KEY, org_id TEXT NOT NULL REFERENCES organizations(id), student_id TEXT NOT NULL REFERENCES users(id),
  object_key TEXT NOT NULL UNIQUE, mime TEXT NOT NULL, size INTEGER NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('needs_review','confirmed')),
  ocr_status TEXT NOT NULL CHECK(ocr_status = 'unavailable'), corrected_text TEXT,
  created_by TEXT NOT NULL REFERENCES users(id), confirmed_by TEXT REFERENCES users(id),
  created_at TEXT NOT NULL, expires_at INTEGER NOT NULL, revision INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE audit_events (
  id TEXT PRIMARY KEY, org_id TEXT NOT NULL REFERENCES organizations(id), actor_id TEXT NOT NULL REFERENCES users(id),
  action TEXT NOT NULL, resource_id TEXT NOT NULL, created_at TEXT NOT NULL
);
