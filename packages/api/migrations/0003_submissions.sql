-- Messages from guests: wishes, replies and RSVPs, plus a way to revoke a contributor link.
ALTER TABLE pages ADD COLUMN contrib_epoch INTEGER NOT NULL DEFAULT 0;

CREATE TABLE submissions (
  id         TEXT PRIMARY KEY,
  page_id    TEXT NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
  block_id   TEXT NOT NULL,
  kind       TEXT NOT NULL CHECK (kind IN ('wish', 'reply', 'rsvp')),
  payload    TEXT NOT NULL,
  status     TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  source     TEXT NOT NULL DEFAULT 'page' CHECK (source IN ('page', 'contributor')),
  read_at    TEXT,
  created_at TEXT NOT NULL,
  ip_hash    TEXT
);
CREATE INDEX submissions_page ON submissions (page_id, kind, created_at DESC);
