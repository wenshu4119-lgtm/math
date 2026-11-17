-- Fixed synthetic examples only; never contains learner questions or grades.
CREATE TABLE deeptutor_lab_jobs (
 id TEXT PRIMARY KEY,
 org_id TEXT NOT NULL REFERENCES organizations(id),
 owner_id TEXT NOT NULL REFERENCES users(id),
 request_id TEXT NOT NULL,
 preset TEXT NOT NULL CHECK(preset IN ('math-equation','english-be','outside-scope')),
 state TEXT NOT NULL CHECK(state IN ('created','running','completed','failed')),
 result_json TEXT,
 created_at TEXT NOT NULL,
 updated_at TEXT NOT NULL,
 UNIQUE(org_id,owner_id,request_id)
);
CREATE INDEX deeptutor_lab_owner ON deeptutor_lab_jobs(org_id,owner_id,created_at);
