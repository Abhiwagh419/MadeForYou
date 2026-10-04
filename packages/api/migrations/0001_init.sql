-- MadeForYou, first schema. Apply with: wrangler d1 migrations apply madeforyou --remote
PRAGMA foreign_keys = ON;

CREATE TABLE users (
  id          TEXT PRIMARY KEY,
  created_at  TEXT NOT NULL
);

CREATE TABLE pages (
  id            TEXT PRIMARY KEY,
  owner_id      TEXT NOT NULL REFERENCES users(id),
  title         TEXT NOT NULL,
  template_id   TEXT,
  content       TEXT NOT NULL,                        -- validated JSON (settings + blocks)
  slug          TEXT UNIQUE,                          -- NULL until published; freed on delete
  status        TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  visibility    TEXT NOT NULL DEFAULT 'unlisted' CHECK (visibility IN ('private', 'unlisted')),
  password_hash TEXT,
  password_salt TEXT,
  unlock_at     TEXT,
  expires_at    TEXT,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL,
  published_at  TEXT,
  deleted_at    TEXT
);
CREATE INDEX pages_owner ON pages (owner_id, updated_at DESC);

CREATE TABLE assets (
  id           TEXT PRIMARY KEY,
  owner_id     TEXT NOT NULL REFERENCES users(id),
  content_type TEXT NOT NULL,
  bytes        INTEGER NOT NULL,
  created_at   TEXT NOT NULL
);
CREATE INDEX assets_owner ON assets (owner_id);

-- which photos a page uses; decides who may fetch a photo
CREATE TABLE page_assets (
  page_id  TEXT NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
  asset_id TEXT NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  PRIMARY KEY (page_id, asset_id)
);
CREATE INDEX page_assets_asset ON page_assets (asset_id);

CREATE TABLE templates (
  id          TEXT PRIMARY KEY,
  owner_id    TEXT NOT NULL REFERENCES users(id),
  meta        TEXT NOT NULL,
  content     TEXT NOT NULL,
  visibility  TEXT NOT NULL CHECK (visibility IN ('private', 'unlisted', 'public')),
  status      TEXT NOT NULL DEFAULT 'approved' CHECK (status IN ('approved', 'pending', 'rejected')),
  from_page   TEXT,
  created_at  TEXT NOT NULL
);
CREATE INDEX templates_listing ON templates (visibility, status, created_at DESC);

-- password attempts and upload bursts; rows older than a day are swept
CREATE TABLE throttle (
  key TEXT NOT NULL,
  at  INTEGER NOT NULL
);
CREATE INDEX throttle_key ON throttle (key, at);
