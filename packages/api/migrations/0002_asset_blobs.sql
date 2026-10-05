-- Photos can live in the database itself (no card needed) or in R2 (if you bind a bucket).
-- D1 allows up to 2 MB per row; photos are compressed in the browser to a few hundred KB, and the server caps them at 1.5 MB.
CREATE TABLE asset_blobs (
  id   TEXT PRIMARY KEY REFERENCES assets(id) ON DELETE CASCADE,
  data BLOB NOT NULL
);
