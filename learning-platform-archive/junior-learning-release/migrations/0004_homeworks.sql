CREATE TABLE homeworks (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizations(id),
  student_id TEXT NOT NULL REFERENCES users(id),
  teacher_id TEXT NOT NULL REFERENCES users(id),
  subject TEXT NOT NULL CHECK(subject IN ('math','english')),
  title TEXT NOT NULL,
  instructions TEXT NOT NULL DEFAULT '',
  due_at TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','published','submitted','graded')),
  revision INTEGER NOT NULL DEFAULT 1,
  write_token TEXT NOT NULL,
  request_id TEXT NOT NULL,
  request_hash TEXT NOT NULL,
  source_pack_id TEXT REFERENCES packs(id),
  source_pack_json TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  published_at TEXT,
  submitted_at TEXT,
  submission_request_id TEXT,
  submission_hash TEXT,
  graded_at TEXT,
  grade_request_id TEXT,
  grade_hash TEXT,
  feedback TEXT,
  family_summary TEXT,
  paper_reference_json TEXT,
  result_json TEXT,
  UNIQUE(org_id,teacher_id,request_id)
);
CREATE INDEX homeworks_student ON homeworks(student_id,created_at);
CREATE INDEX homeworks_teacher ON homeworks(teacher_id,created_at);
CREATE TABLE homework_items (
  homework_id TEXT NOT NULL REFERENCES homeworks(id),
  question_id TEXT NOT NULL REFERENCES questions(id),
  position INTEGER NOT NULL,
  snapshot_json TEXT NOT NULL,
  max_cents INTEGER NOT NULL CHECK(max_cents>0 AND max_cents<=100000),
  PRIMARY KEY(homework_id,question_id)
);
CREATE TABLE homework_answers (
  homework_id TEXT NOT NULL,
  question_id TEXT NOT NULL,
  selected_option INTEGER NOT NULL CHECK(selected_option>=0),
  work_text TEXT NOT NULL DEFAULT '',
  PRIMARY KEY(homework_id,question_id),
  FOREIGN KEY(homework_id,question_id) REFERENCES homework_items(homework_id,question_id)
);
CREATE TABLE homework_marks (
  homework_id TEXT NOT NULL,
  question_id TEXT NOT NULL,
  earned_cents INTEGER NOT NULL CHECK(earned_cents>=0 AND earned_cents<=100000),
  note TEXT NOT NULL DEFAULT '',
  PRIMARY KEY(homework_id,question_id),
  FOREIGN KEY(homework_id,question_id) REFERENCES homework_items(homework_id,question_id)
);
