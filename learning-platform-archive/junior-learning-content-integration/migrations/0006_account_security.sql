-- Existing accounts retain access. New or explicitly bootstrapped accounts must
-- change their one-time password before accessing any business API.
ALTER TABLE users ADD COLUMN must_change_password INTEGER NOT NULL DEFAULT 0 CHECK(must_change_password IN (0,1));
