CREATE TABLE checks (
  id TEXT PRIMARY KEY NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('standings', 'scores')),
  checkedAt INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('recent', 'stale', 'unknown', 'failed')),
  sourceDate TEXT NOT NULL,
  records INTEGER NOT NULL CHECK (records >= 0),
  httpStatus INTEGER NOT NULL CHECK (httpStatus >= 0 AND httpStatus <= 599),
  detail TEXT NOT NULL
);
CREATE INDEX checks_recent ON checks (checkedAt DESC, id DESC);
