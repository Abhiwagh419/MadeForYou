-- photos stored in the database (D1 rows can be up to 2 MB, photos are capped at 1.5 MB)
CREATE TABLE asset_blobs (
  id   TEXT PRIMARY KEY REFERENCES assets(id) ON DELETE CASCADE,
  data BLOB NOT NULL
);
