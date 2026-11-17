-- Additive only. Rollback the application, retain these records; no old table rewrite.
CREATE TABLE time_plans (
 id TEXT PRIMARY KEY, org_id TEXT NOT NULL REFERENCES organizations(id), student_id TEXT NOT NULL REFERENCES users(id),
 stage TEXT NOT NULL CHECK(stage IN ('junior','senior_arts')), exam_year INTEGER NOT NULL, grade INTEGER,
 version INTEGER NOT NULL CHECK(version>0), payload_json TEXT NOT NULL, created_by TEXT NOT NULL REFERENCES users(id), created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE INDEX time_plans_scope ON time_plans(org_id,student_id,stage,exam_year,grade);
CREATE TABLE time_plan_versions (
 plan_id TEXT NOT NULL REFERENCES time_plans(id), version INTEGER NOT NULL, payload_json TEXT NOT NULL,
 reason TEXT NOT NULL, actor_id TEXT NOT NULL REFERENCES users(id), created_at TEXT NOT NULL,
 PRIMARY KEY(plan_id,version)
);
CREATE TABLE time_plan_previews (
 id TEXT PRIMARY KEY, org_id TEXT NOT NULL REFERENCES organizations(id), student_id TEXT NOT NULL REFERENCES users(id),
 actor_id TEXT NOT NULL REFERENCES users(id), plan_id TEXT REFERENCES time_plans(id), base_version INTEGER NOT NULL,
 payload_json TEXT NOT NULL, evidence_hash TEXT NOT NULL, expires_at INTEGER NOT NULL, consumed INTEGER NOT NULL DEFAULT 0,
 created_at TEXT NOT NULL
);
CREATE TABLE time_plan_events (
 id TEXT PRIMARY KEY, plan_id TEXT NOT NULL REFERENCES time_plans(id), task_id TEXT NOT NULL, status TEXT NOT NULL CHECK(status IN ('started','completed','skipped','reopened')),
 minutes INTEGER NOT NULL CHECK(minutes>=0), local_date TEXT NOT NULL, note TEXT NOT NULL, actor_id TEXT NOT NULL REFERENCES users(id), created_at TEXT NOT NULL, request_id TEXT NOT NULL,
 UNIQUE(plan_id,request_id)
);
