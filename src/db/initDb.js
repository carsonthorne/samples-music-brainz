const fs = require("fs");
const path = require("path");
const { DEFAULT_DB_PATH, openDb } = require("./openDb");

const SCHEMA_PATH = path.join(__dirname, "schema.sql");

function initDb(options = {}) {
  const db = openDb({
    ...options,
    mode: options.mode || "build",
  });

  const schema = fs.readFileSync(SCHEMA_PATH, "utf8");
  db.exec(schema);

  return db;
}

if (require.main === module) {
  const db = initDb();
  const tables = db
    .prepare(
      `
      SELECT name
      FROM sqlite_master
      WHERE type = 'table'
      ORDER BY name
      `
    )
    .all()
    .map((row) => row.name);

  console.log("Initialized database:", process.env.SAMPLE_GRAPH_DB || DEFAULT_DB_PATH);
  console.log("Tables:", tables.join(", "));

  db.close();
}

module.exports = {
  initDb,
};
