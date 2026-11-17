-- System verification is an audit action, never an impersonated teacher review.
CREATE TABLE bank_recheck_batches (
 org_id TEXT NOT NULL REFERENCES organizations(id), id TEXT NOT NULL,
 digest TEXT NOT NULL, metadata_json TEXT NOT NULL, created_at TEXT NOT NULL,
 PRIMARY KEY(org_id,id)
);
CREATE TABLE bank_recheck_items (
 org_id TEXT NOT NULL, batch_id TEXT NOT NULL, question_id TEXT NOT NULL,
 expected_revision INTEGER NOT NULL, expected_hash TEXT NOT NULL,
 applied_revision INTEGER, applied_hash TEXT, prior_json TEXT,
 result TEXT NOT NULL CHECK(result IN ('applied','conflict','rolled_back','rollback_conflict')),
 created_at TEXT NOT NULL, rollback_at TEXT,
 PRIMARY KEY(org_id,batch_id,question_id),
 FOREIGN KEY(org_id,batch_id) REFERENCES bank_recheck_batches(org_id,id)
);
