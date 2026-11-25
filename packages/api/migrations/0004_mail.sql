

ALTER TABLE users ADD COLUMN email TEXT;
ALTER TABLE users ADD COLUMN email_at TEXT;

ALTER TABLE submissions ADD COLUMN remind_at TEXT;
ALTER TABLE submissions ADD COLUMN event_at TEXT;
CREATE INDEX submissions_remind ON submissions (remind_at) WHERE remind_at IS NOT NULL;

CREATE TABLE deliveries (
  id         TEXT PRIMARY KEY,
  page_id    TEXT NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
  owner_id   TEXT NOT NULL,
  to_email   TEXT NOT NULL,
  to_name    TEXT,
  from_name  TEXT NOT NULL,
  note       TEXT,
  send_at    TEXT NOT NULL,
  status     TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'sending', 'sent', 'failed', 'cancelled')),
  error      TEXT,
  attempts   INTEGER NOT NULL DEFAULT 0,
  claimed_at TEXT,
  sent_at    TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX deliveries_due ON deliveries (status, send_at);
CREATE INDEX deliveries_page ON deliveries (page_id);

CREATE TABLE mail_log (
  key  TEXT PRIMARY KEY,
  at   TEXT NOT NULL,
  sent INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX mail_log_at ON mail_log (at);

CREATE TABLE mail_blocks (
  email TEXT PRIMARY KEY,
  at    TEXT NOT NULL
);
