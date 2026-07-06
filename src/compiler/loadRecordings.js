const { streamTar } = require("./streamTar");
const { initDb } = require("../db/initDb");

const DUMP_PATH =
  process.env.MUSICBRAINZ_DUMP || "musicbrainz-dump/mbdump.tar.bz2";

const BATCH_SIZE = Number(process.env.BATCH_SIZE || 50000);

function nullIfMusicBrainzNull(value) {
  return value && value !== "\\N" ? value : null;
}

function intOrNull(value) {
  const normalized = nullIfMusicBrainzNull(value);
  return normalized === null ? null : Number(normalized);
}

async function loadRecordings() {
  console.log("Loading recordings into SQLite...");
  console.log("Dump:", DUMP_PATH);

  const db = initDb({
    mode: "build",
  });

  const insert = db.prepare(
    `
    INSERT OR IGNORE INTO tracks (
      source_recording_id,
      mbid,
      title,
      length,
      disambiguation
    )
    VALUES (?, ?, ?, ?, ?)
    `
  );

  const insertBatch = db.transaction((rows) => {
    for (const row of rows) {
      insert.run(
        row.sourceRecordingId,
        row.mbid,
        row.title,
        row.length,
        row.disambiguation
      );
    }
  });

  const rl = streamTar(DUMP_PATH, "mbdump/recording");
  let batch = [];
  let count = 0;
  let skipped = 0;

  for await (const line of rl) {
    if (!line.trim()) continue;

    const cols = line.split("\t");

    // recording:
    // 0 id, 1 gid/mbid, 2 name, 3 artist_credit, 4 length, 5 comment
    if (cols.length < 3) {
      skipped++;
      continue;
    }

    const sourceRecordingId = intOrNull(cols[0]);
    const mbid = nullIfMusicBrainzNull(cols[1]);
    const title = nullIfMusicBrainzNull(cols[2]);

    if (!sourceRecordingId || !mbid || !title) {
      skipped++;
      continue;
    }

    batch.push({
      sourceRecordingId,
      mbid,
      title,
      length: intOrNull(cols[4]),
      disambiguation: nullIfMusicBrainzNull(cols[5]),
    });

    if (batch.length >= BATCH_SIZE) {
      insertBatch(batch);
      count += batch.length;
      batch = [];

      if (count % 1000000 === 0) {
        console.log(`[recordings] ${count.toLocaleString()}`);
      }
    }
  }

  if (batch.length > 0) {
    insertBatch(batch);
    count += batch.length;
  }

  const totalTracks = db
    .prepare("SELECT COUNT(*) AS count FROM tracks")
    .get().count;

  console.log("DONE loadRecordings");
  console.log("Inserted/seen:", count.toLocaleString());
  console.log("Skipped:", skipped.toLocaleString());
  console.log("tracks rows:", totalTracks.toLocaleString());

  db.close();
}

loadRecordings().catch((error) => {
  console.error(error);
  process.exit(1);
});
