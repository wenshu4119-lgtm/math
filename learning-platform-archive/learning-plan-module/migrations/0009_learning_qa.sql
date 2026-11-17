-- No question text, learner evidence, uploaded files or generated answer text is stored.
CREATE TABLE learning_qa_jobs (
 id TEXT PRIMARY KEY,
 org_id TEXT NOT NULL REFERENCES organizations(id),
 owner_id TEXT NOT NULL REFERENCES users(id),
 request_id TEXT NOT NULL,
 question_digest TEXT NOT NULL,
 subject TEXT NOT NULL CHECK(subject IN ('math','english')),
 state TEXT NOT NULL CHECK(state IN ('created','running','completed','failed','expired')),
 result_digest TEXT,
 outcome TEXT,
 created_at TEXT NOT NULL,
 updated_at TEXT NOT NULL,
 expires_at INTEGER NOT NULL,
 UNIQUE(org_id,owner_id,request_id)
);
CREATE INDEX learning_qa_jobs_owner ON learning_qa_jobs(org_id,owner_id,created_at);
