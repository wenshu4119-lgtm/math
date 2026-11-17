-- Additive self-study evidence. Existing questions/attempts/bank/arts remain unchanged.
CREATE TABLE study_meta (org_id TEXT PRIMARY KEY REFERENCES organizations(id), version INTEGER NOT NULL DEFAULT 0, write_token TEXT);
CREATE TABLE study_imports (org_id TEXT NOT NULL REFERENCES organizations(id), package_hash TEXT NOT NULL, audit_hash TEXT NOT NULL, result_json TEXT NOT NULL, imported_at TEXT NOT NULL, PRIMARY KEY(org_id,package_hash,audit_hash));
CREATE TABLE study_content_heads (org_id TEXT NOT NULL REFERENCES organizations(id), id TEXT NOT NULL, kind TEXT NOT NULL CHECK(kind IN ('point','question')), current_version INTEGER NOT NULL DEFAULT 0, PRIMARY KEY(org_id,id));
CREATE TABLE study_content_versions (
 org_id TEXT NOT NULL, content_id TEXT NOT NULL, version INTEGER NOT NULL CHECK(version>0),
 kind TEXT NOT NULL CHECK(kind IN ('point','question')), stage TEXT NOT NULL CHECK(stage IN ('junior','senior_arts')),
 grade INTEGER, exam_year INTEGER, subject TEXT NOT NULL, primary_point_id TEXT,
 quality_status TEXT NOT NULL CHECK(quality_status IN ('draft','auto_checked','human_reviewed','quarantined')),
 content_hash TEXT NOT NULL, body_json TEXT NOT NULL, source_json TEXT NOT NULL, automatic_json TEXT NOT NULL,
 actor_id TEXT REFERENCES users(id), reason TEXT NOT NULL, created_at TEXT NOT NULL,
 PRIMARY KEY(org_id,content_id,version), FOREIGN KEY(org_id,content_id) REFERENCES study_content_heads(org_id,id),
 CHECK((stage='junior' AND grade IN (7,8,9) AND exam_year IS NULL) OR (stage='senior_arts' AND grade IS NULL AND exam_year BETWEEN 2026 AND 2100))
);
CREATE TRIGGER study_content_advance AFTER INSERT ON study_content_versions BEGIN UPDATE study_content_heads SET current_version=NEW.version WHERE org_id=NEW.org_id AND id=NEW.content_id; END;
CREATE TABLE study_question_knowledge (org_id TEXT NOT NULL, question_id TEXT NOT NULL, question_version INTEGER NOT NULL, point_id TEXT NOT NULL, relation TEXT NOT NULL CHECK(relation IN ('primary','related')), PRIMARY KEY(org_id,question_id,question_version,point_id), FOREIGN KEY(org_id,question_id,question_version) REFERENCES study_content_versions(org_id,content_id,version));
CREATE TABLE study_reviews (org_id TEXT NOT NULL, content_id TEXT NOT NULL, version INTEGER NOT NULL, reviewer_id TEXT NOT NULL REFERENCES users(id), reason TEXT NOT NULL, created_at TEXT NOT NULL, PRIMARY KEY(org_id,content_id,version), FOREIGN KEY(org_id,content_id,version) REFERENCES study_content_versions(org_id,content_id,version));
CREATE TABLE study_content_reports (id TEXT PRIMARY KEY, org_id TEXT NOT NULL, content_id TEXT NOT NULL, version INTEGER NOT NULL, severity TEXT NOT NULL CHECK(severity IN ('minor','serious')), reason TEXT NOT NULL, reported_by TEXT NOT NULL REFERENCES users(id), disposition TEXT NOT NULL CHECK(disposition IN ('needs_teacher_review','recorded','quarantined')), created_at TEXT NOT NULL, FOREIGN KEY(org_id,content_id,version) REFERENCES study_content_versions(org_id,content_id,version));
CREATE TABLE study_cycles (
 id TEXT PRIMARY KEY, org_id TEXT NOT NULL REFERENCES organizations(id), student_id TEXT NOT NULL REFERENCES users(id),
 request_id TEXT NOT NULL, request_hash TEXT NOT NULL, stage TEXT NOT NULL CHECK(stage IN ('junior','senior_arts')),
 grade INTEGER, exam_year INTEGER, subject TEXT NOT NULL, point_ids_json TEXT NOT NULL,
 mode TEXT NOT NULL CHECK(mode IN ('online','paper')), state TEXT NOT NULL CHECK(state IN ('diagnostic','learning','practice','retest','completed')),
 version INTEGER NOT NULL DEFAULT 1, write_token TEXT, previous_cycle_id TEXT UNIQUE REFERENCES study_cycles(id),
 adjustment_reason TEXT NOT NULL DEFAULT '', created_by TEXT NOT NULL REFERENCES users(id), created_at TEXT NOT NULL,
 UNIQUE(org_id,request_id), CHECK((stage='junior' AND grade IN (7,8,9) AND exam_year IS NULL) OR (stage='senior_arts' AND grade IS NULL AND exam_year BETWEEN 2026 AND 2100))
);
CREATE TABLE study_attempts (
 id TEXT PRIMARY KEY, cycle_id TEXT NOT NULL REFERENCES study_cycles(id), org_id TEXT NOT NULL REFERENCES organizations(id), student_id TEXT NOT NULL REFERENCES users(id),
 phase TEXT NOT NULL CHECK(phase IN ('diagnostic','practice','retest')), mode TEXT NOT NULL CHECK(mode IN ('online','paper')),
 version INTEGER NOT NULL DEFAULT 1, state TEXT NOT NULL CHECK(state IN ('open','submitted')), snapshot_json TEXT NOT NULL,
 draft_answers_json TEXT, answers_json TEXT, result_json TEXT, report_json TEXT, report_version INTEGER, algorithm_version TEXT, report_created_at TEXT, source TEXT CHECK(source IN ('student_online','teacher_recorded_online','student_verified_manual','teacher_verified_manual')),
 created_by TEXT NOT NULL REFERENCES users(id), submitted_by TEXT REFERENCES users(id), created_at TEXT NOT NULL, submitted_at TEXT,
 elapsed_seconds INTEGER, UNIQUE(cycle_id,phase)
);
CREATE TABLE study_tasks (id TEXT PRIMARY KEY, cycle_id TEXT NOT NULL UNIQUE REFERENCES study_cycles(id), org_id TEXT NOT NULL REFERENCES organizations(id), student_id TEXT NOT NULL REFERENCES users(id), diagnostic_id TEXT NOT NULL UNIQUE REFERENCES study_attempts(id), version INTEGER NOT NULL DEFAULT 1, state TEXT NOT NULL CHECK(state IN ('ready','practicing','practice_completed','retesting','completed')), payload_json TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE study_task_versions (task_id TEXT NOT NULL REFERENCES study_tasks(id), version INTEGER NOT NULL, payload_json TEXT NOT NULL, reason TEXT NOT NULL, actor_id TEXT NOT NULL REFERENCES users(id), created_at TEXT NOT NULL, PRIMARY KEY(task_id,version));
CREATE TABLE study_activities (id TEXT PRIMARY KEY, task_id TEXT NOT NULL REFERENCES study_tasks(id), org_id TEXT NOT NULL REFERENCES organizations(id), student_id TEXT NOT NULL REFERENCES users(id), request_id TEXT NOT NULL, request_hash TEXT NOT NULL, kind TEXT NOT NULL CHECK(kind IN ('reading_started','reading_completed','memory_reviewed','offline_guidance')), note TEXT NOT NULL, actor_id TEXT NOT NULL REFERENCES users(id), source TEXT NOT NULL CHECK(source IN ('student_self','teacher_guidance')), created_at TEXT NOT NULL, UNIQUE(org_id,request_id));
-- No FK to uploads: deleting/expiring a private image must remain possible. The
-- binding keeps metadata evidence, while every image access checks active uploads.
CREATE TABLE study_attempt_uploads (attempt_id TEXT NOT NULL REFERENCES study_attempts(id), org_id TEXT NOT NULL REFERENCES organizations(id), student_id TEXT NOT NULL REFERENCES users(id), upload_id TEXT NOT NULL, position INTEGER NOT NULL, metadata_json TEXT NOT NULL, reason TEXT NOT NULL, actor_id TEXT NOT NULL REFERENCES users(id), created_at TEXT NOT NULL, PRIMARY KEY(attempt_id,upload_id));
CREATE TABLE study_events (id TEXT PRIMARY KEY, org_id TEXT NOT NULL REFERENCES organizations(id), cycle_id TEXT REFERENCES study_cycles(id), resource_id TEXT NOT NULL, action TEXT NOT NULL, actor_id TEXT NOT NULL REFERENCES users(id), metadata_json TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE INDEX study_cycles_scope ON study_cycles(org_id,student_id,stage,grade,exam_year,subject,created_at);
CREATE INDEX study_content_scope ON study_content_versions(org_id,stage,grade,exam_year,subject,kind,primary_point_id);
