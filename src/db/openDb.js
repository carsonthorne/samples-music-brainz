const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");

const DEFAULT_DB_PATH = path.resolve(
  __dirname,
  "../../data/sample-graph.sqlite"
);

function openDb(options = {}) {
  const databasePath =
    options.databasePath ||
    process.env.SAMPLE_GRAPH_DB ||
    DEFAULT_DB_PATH;

  const mode = options.mode || process.env.SAMPLE_GRAPH_DB_MODE || "runtime";

  fs.mkdirSync(path.dirname(databasePath), {
    recursive: true,
  });

  const db = new Database(databasePath);

  db.pragma("busy_timeout = 5000");
  db.pragma("temp_store = MEMORY");

  if (mode === "build") {
  db.pragma("journal_mode = DELETE");
  db.pragma("synchronous = OFF");
  db.pragma("foreign_keys = OFF");
  db.pragma("locking_mode = EXCLUSIVE");
  db.pragma("temp_store = MEMORY");
  db.pragma("cache_size = -200000");
  } else {
    db.pragma("journal_mode = WAL");
    db.pragma("synchronous = NORMAL");
    db.pragma("foreign_keys = ON");
  }

  return db;
}

module.exports = {
  DEFAULT_DB_PATH,
  openDb,
};
