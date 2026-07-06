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

async function loadMbTracks() {
  console.log("Loading MusicBrainz track rows into SQLite...");
  console.log("Dump:", DUMP_PATH);

  const db = initDb({
    mode: "build",
  });

  const insert = db.prepare(
    `
    INSERT OR IGNORE INTO mb_tracks (
      source_track_id,
      source_recording_id,
      source_medium_id,
      position,
      track_number,
      title
    )
    VALUES (?, ?, ?, ?, ?, ?)
    `
  );

  const insertBatch = db.transaction((rows) => {
    for (const row of rows) {
      insert.run(
        row.sourceTrackId,
        row.sourceRecordingId,
        row.sourceMediumId,
        row.position,
        row.trackNumber,
        row.title
      );
    }
  });

  const rl = streamTar(DUMP_PATH, "mbdump/track");
  let batch = [];
  let count = 0;
  let skipped = 0;

  for await (const line of rl) {
    if (!line.trim()) continue;

    const cols = line.split("\t");

    // track:
    // 0 id, 1 gid/mbid, 2 recording, 3 medium,
    // 4 position, 5 number, 6 name
    if (cols.length < 7) {
      skipped++;
      continue;
    }

    const sourceTrackId = intOrNull(cols[0]);
    const sourceRecordingId = intOrNull(cols[2]);
    const sourceMediumId = intOrNull(cols[3]);

    if (!sourceTrackId || !sourceRecordingId || !sourceMediumId) {
      skipped++;
      continue;
    }

    batch.push({
      sourceTrackId,
      sourceRecordingId,
      sourceMediumId,
      position: intOrNull(cols[4]),
      trackNumber: nullIfMusicBrainzNull(cols[5]),
      title: nullIfMusicBrainzNull(cols[6]),
    });

    if (batch.length >= BATCH_SIZE) {
      insertBatch(batch);
      count += batch.length;
      batch = [];

      if (count % 1000000 === 0) {
        console.log(`[mb_tracks] ${count.toLocaleString()}`);
      }
    }
  }

  if (batch.length > 0) {
    insertBatch(batch);
    count += batch.length;
  }

  const totalTracks = db
    .prepare("SELECT COUNT(*) AS count FROM mb_tracks")
    .get().count;

  console.log("DONE loadMbTracks");
  console.log("Inserted/seen:", count.toLocaleString());
  console.log("Skipped:", skipped.toLocaleString());
  console.log("mb_tracks rows:", totalTracks.toLocaleString());

  db.close();
}

loadMbTracks().catch((error) => {
  console.error(error);
  process.exit(1);
});
