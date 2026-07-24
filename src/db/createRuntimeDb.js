const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");

const DEFAULT_SOURCE = path.resolve(process.cwd(), "data/sample-graph.sqlite");
const DEFAULT_TARGET = path.resolve(process.cwd(), "data/sample-graph-runtime.sqlite");
const MIN_FREE_BYTES = 4 * 1024 * 1024 * 1024;

const sourcePath = path.resolve(process.argv[2] || process.env.SOURCE_DB || DEFAULT_SOURCE);
const targetPath = path.resolve(process.argv[3] || process.env.RUNTIME_DB || DEFAULT_TARGET);

function formatBytes(bytes) {
  return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
}

function assertUsablePaths() {
  if (!fs.existsSync(sourcePath)) {
    throw new Error(`Source database not found: ${sourcePath}`);
  }

  if (sourcePath === targetPath) {
    throw new Error("Target database must be different from source database.");
  }

  fs.mkdirSync(path.dirname(targetPath), { recursive: true });

  if (fs.existsSync(targetPath)) {
    throw new Error(`Target already exists: ${targetPath}`);
  }

  const stats = fs.statfsSync(path.dirname(targetPath));
  const available = stats.bavail * stats.bsize;

  if (available < MIN_FREE_BYTES) {
    throw new Error(
      `Not enough free space to create runtime DB. Available: ${formatBytes(available)}`
    );
  }
}

function runStep(db, label, sql) {
  console.time(label);
  db.exec(sql);
  console.timeEnd(label);
}

assertUsablePaths();

console.log("Creating runtime database");
console.log("Source:", sourcePath);
console.log("Target:", targetPath);

const db = new Database(targetPath);

try {
  db.pragma("journal_mode = OFF");
  db.pragma("synchronous = OFF");
  db.pragma("temp_store = MEMORY");
  db.pragma("foreign_keys = OFF");

  db.exec(`ATTACH DATABASE '${sourcePath.replaceAll("'", "''")}' AS source;`);

  runStep(db, "create tables", `
    CREATE TABLE artists (
      id INTEGER PRIMARY KEY,
      mbid TEXT NOT NULL,
      name TEXT NOT NULL,
      sort_name TEXT,
      disambiguation TEXT
    );

    CREATE TABLE albums (
      id INTEGER PRIMARY KEY,
      mbid TEXT NOT NULL,
      title TEXT NOT NULL,
      first_release_date TEXT,
      type TEXT,
      disambiguation TEXT
    );

    CREATE TABLE tracks (
      id INTEGER PRIMARY KEY,
      mbid TEXT NOT NULL,
      title TEXT NOT NULL,
      length INTEGER,
      disambiguation TEXT
    );

    CREATE TABLE artist_albums (
      artist_id INTEGER NOT NULL,
      album_id INTEGER NOT NULL,
      PRIMARY KEY (artist_id, album_id)
    );

    CREATE TABLE album_tracks (
      album_id INTEGER NOT NULL,
      track_id INTEGER NOT NULL,
      position INTEGER,
      track_number TEXT,
      title_on_release TEXT,
      PRIMARY KEY (album_id, track_id)
    );

    CREATE TABLE track_samples (
      track_id INTEGER NOT NULL,
      sampled_track_id INTEGER NOT NULL,
      relationship_type TEXT NOT NULL,
      PRIMARY KEY (track_id, sampled_track_id, relationship_type)
    );
  `);

  runStep(db, "copy artists", `
    INSERT INTO artists (id, mbid, name, sort_name, disambiguation)
    SELECT id, mbid, name, sort_name, disambiguation
    FROM source.artists;
  `);

  runStep(db, "copy albums", `
    INSERT INTO albums (id, mbid, title, first_release_date, type, disambiguation)
    SELECT id, mbid, title, first_release_date, type, disambiguation
    FROM source.albums;
  `);

  runStep(db, "copy tracks", `
    INSERT INTO tracks (id, mbid, title, length, disambiguation)
    SELECT id, mbid, title, length, disambiguation
    FROM source.tracks;
  `);

  runStep(db, "copy artist_albums", `
    INSERT INTO artist_albums (artist_id, album_id)
    SELECT artist_id, album_id
    FROM source.artist_albums;
  `);

  runStep(db, "copy album_tracks", `
    INSERT INTO album_tracks (album_id, track_id, position, track_number, title_on_release)
    SELECT album_id, track_id, position, track_number, title_on_release
    FROM source.album_tracks;
  `);

  runStep(db, "copy track_samples", `
    INSERT INTO track_samples (track_id, sampled_track_id, relationship_type)
    SELECT track_id, sampled_track_id, relationship_type
    FROM source.track_samples;
  `);

  runStep(db, "create indexes", `
    CREATE INDEX idx_artists_name_nocase ON artists(name COLLATE NOCASE);
    CREATE INDEX idx_albums_title_nocase ON albums(title COLLATE NOCASE);
    CREATE INDEX idx_tracks_title_nocase ON tracks(title COLLATE NOCASE);
    CREATE INDEX idx_artist_albums_album ON artist_albums(album_id);
    CREATE INDEX idx_album_tracks_track ON album_tracks(track_id);
    CREATE INDEX idx_album_tracks_album_position ON album_tracks(album_id, position);
    CREATE INDEX idx_track_samples_track ON track_samples(track_id);
    CREATE INDEX idx_track_samples_sampled ON track_samples(sampled_track_id);
  `);

  runStep(db, "analyze", "ANALYZE;");

  const outputSize = fs.statSync(targetPath).size;
  console.log("Runtime database created:", targetPath);
  console.log("Runtime database size:", formatBytes(outputSize));
}
catch (error) {
  db.close();

  if (fs.existsSync(targetPath)) {
    fs.rmSync(targetPath, { force: true });
  }

  throw error;
}

db.close();
