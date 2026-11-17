-- Additive module: no changes to junior records or account ownership.
CREATE TABLE arts_content_versions (
 org_id TEXT NOT NULL REFERENCES organizations(id), point_id TEXT NOT NULL,
 version INTEGER NOT NULL CHECK(version>0), subject TEXT NOT NULL,
 stage TEXT NOT NULL DEFAULT 'senior_arts' CHECK(stage='senior_arts'),
 payload_json TEXT NOT NULL, status TEXT NOT NULL CHECK(status IN ('pending_human','quarantined')),
 reason TEXT NOT NULL, created_by TEXT REFERENCES users(id), created_at TEXT NOT NULL,
 PRIMARY KEY(org_id,point_id,version)
);
CREATE TABLE arts_reviews (
 org_id TEXT NOT NULL, point_id TEXT NOT NULL, version INTEGER NOT NULL,
 reviewed_by TEXT NOT NULL REFERENCES users(id), reviewed_at TEXT NOT NULL,
 PRIMARY KEY(org_id,point_id,version),
 FOREIGN KEY(org_id,point_id,version) REFERENCES arts_content_versions(org_id,point_id,version)
);
CREATE TABLE arts_reports (
 id TEXT PRIMARY KEY, org_id TEXT NOT NULL, point_id TEXT NOT NULL, version INTEGER NOT NULL,
 severity TEXT NOT NULL CHECK(severity IN ('minor','serious')), reason TEXT NOT NULL,
 reported_by TEXT NOT NULL REFERENCES users(id), created_at TEXT NOT NULL,
 FOREIGN KEY(org_id,point_id,version) REFERENCES arts_content_versions(org_id,point_id,version)
);
CREATE TABLE arts_plans (
 id TEXT PRIMARY KEY, org_id TEXT NOT NULL REFERENCES organizations(id),
 student_id TEXT NOT NULL REFERENCES users(id), stage TEXT NOT NULL DEFAULT 'senior_arts' CHECK(stage='senior_arts'),
 exam_year INTEGER NOT NULL CHECK(exam_year BETWEEN 2026 AND 2100),
 combination TEXT NOT NULL CHECK(combination='history_geography_politics'),
 version INTEGER NOT NULL CHECK(version>0), payload_json TEXT NOT NULL,
 created_by TEXT NOT NULL REFERENCES users(id), created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
 UNIQUE(org_id,student_id,stage,exam_year)
);
CREATE TABLE arts_plan_versions (
 plan_id TEXT NOT NULL REFERENCES arts_plans(id), version INTEGER NOT NULL,
 payload_json TEXT NOT NULL, reason TEXT NOT NULL, actor_id TEXT NOT NULL REFERENCES users(id), created_at TEXT NOT NULL,
 PRIMARY KEY(plan_id,version)
);
CREATE TABLE arts_attempts (
 id TEXT PRIMARY KEY, org_id TEXT NOT NULL REFERENCES organizations(id), student_id TEXT NOT NULL REFERENCES users(id),
 plan_id TEXT NOT NULL REFERENCES arts_plans(id), plan_version INTEGER NOT NULL,
 stage TEXT NOT NULL DEFAULT 'senior_arts' CHECK(stage='senior_arts'), exam_year INTEGER NOT NULL,
 subject TEXT NOT NULL, point_id TEXT NOT NULL, content_version INTEGER NOT NULL,
 phase TEXT NOT NULL CHECK(phase IN ('diagnostic','practice','retest')),
 diagnostic_id TEXT REFERENCES arts_attempts(id), status TEXT NOT NULL CHECK(status IN ('open','submitted')),
 snapshot_json TEXT NOT NULL, answers_json TEXT, correct INTEGER, total INTEGER,
 created_by TEXT NOT NULL REFERENCES users(id), submitted_by TEXT REFERENCES users(id),
 source TEXT CHECK(source IN ('student_self','teacher_recorded')), created_at TEXT NOT NULL, submitted_at TEXT,
 UNIQUE(diagnostic_id,phase)
);
CREATE INDEX arts_attempts_scope ON arts_attempts(org_id,student_id,exam_year,subject,created_at);
CREATE INDEX arts_content_latest ON arts_content_versions(org_id,point_id,version DESC);
