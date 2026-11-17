CREATE TABLE time_plan_profiles (
 plan_id TEXT PRIMARY KEY REFERENCES time_plans(id), org_id TEXT NOT NULL REFERENCES organizations(id),
 student_id TEXT NOT NULL REFERENCES users(id), stage TEXT NOT NULL CHECK(stage IN ('junior','senior_arts')),
 exam_year INTEGER NOT NULL, grade_key INTEGER NOT NULL,
 name TEXT NOT NULL, status TEXT NOT NULL CHECK(status IN ('draft','active','paused','completed','archived')),
 kind TEXT NOT NULL CHECK(kind IN ('evidence','custom','mixed')), created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE UNIQUE INDEX time_plan_one_active_scope ON time_plan_profiles(org_id,student_id,stage,exam_year,grade_key) WHERE status='active';
CREATE TABLE time_plan_reflections (
 id TEXT PRIMARY KEY, plan_id TEXT NOT NULL REFERENCES time_plans(id), week_start TEXT NOT NULL,
 version INTEGER NOT NULL, snapshot_json TEXT NOT NULL, text_json TEXT NOT NULL,
 actor_id TEXT NOT NULL REFERENCES users(id), created_at TEXT NOT NULL, previous_id TEXT REFERENCES time_plan_reflections(id),
 request_id TEXT NOT NULL, UNIQUE(plan_id,request_id)
);
CREATE INDEX time_plan_reflections_history ON time_plan_reflections(plan_id,week_start,created_at);
