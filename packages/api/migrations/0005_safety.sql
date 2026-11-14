-- Safety: reports about pages, takedowns by the site owner, and clean-up of old deleted pages.
-- Apply with: wrangler d1 migrations apply madeforyou --remote   (pnpm run cf:deploy does this for you)

CREATE TABLE reports (
  id         TEXT PRIMARY KEY,
  page_id    TEXT NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
  slug       TEXT,
  reason     TEXT NOT NULL CHECK (reason IN ('abuse', 'private', 'copyright', 'spam', 'other')),
  details    TEXT,
  contact    TEXT,
  status     TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'removed', 'dismissed')),
  ip_hash    TEXT,
  created_at TEXT NOT NULL,
  handled_at TEXT
);
CREATE INDEX reports_open ON reports (status, created_at DESC);
CREATE INDEX reports_page ON reports (page_id);

-- A page the site owner has taken down. Its owner cannot publish it again until it is restored.
ALTER TABLE pages ADD COLUMN taken_down_at TEXT;
ALTER TABLE pages ADD COLUMN takedown_reason TEXT;
