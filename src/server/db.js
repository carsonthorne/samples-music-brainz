const path = require("path");
const Database = require("better-sqlite3");

const DB_PATH = process.env.SAMPLE_GRAPH_DB ||
  path.resolve(process.cwd(), "data/sample-graph.sqlite");

const db = new Database(DB_PATH, {
  readonly: true,
  fileMustExist: true,
});

// Runtime API is read-only. The compiler/build scripts are responsible for writes.
db.pragma("query_only = ON");
db.pragma("foreign_keys = ON");
db.pragma("temp_store = MEMORY");

module.exports = {
  db,
  DB_PATH,
};
