-- Private admin drafts only. No public contact, live integration or payment state.
CREATE TABLE referral_contact_drafts (
 id TEXT PRIMARY KEY,
 org_id TEXT NOT NULL UNIQUE REFERENCES organizations(id),
 version INTEGER NOT NULL CHECK(version > 0),
 state TEXT NOT NULL DEFAULT 'draft_pending_review' CHECK(state='draft_pending_review'),
 payload_json TEXT NOT NULL CHECK(json_valid(payload_json)),
 reason TEXT NOT NULL,
 created_by TEXT NOT NULL REFERENCES users(id),
 created_at TEXT NOT NULL,
 updated_at TEXT NOT NULL
);
CREATE TABLE referral_contact_draft_versions (
 draft_id TEXT NOT NULL REFERENCES referral_contact_drafts(id),
 org_id TEXT NOT NULL REFERENCES organizations(id),
 version INTEGER NOT NULL CHECK(version > 0),
 payload_json TEXT NOT NULL CHECK(json_valid(payload_json)),
 reason TEXT NOT NULL,
 actor_id TEXT NOT NULL REFERENCES users(id),
 created_at TEXT NOT NULL,
 PRIMARY KEY(draft_id,version)
);
CREATE INDEX referral_contact_versions_scope ON referral_contact_draft_versions(org_id,draft_id,version DESC);
