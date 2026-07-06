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

async function loadArtists() {
  console.log("Loading artists into SQLite...");
  console.log("Dump:", DUMP_PATH);

  const db = initDb({
    mode: "build",
  });

  const insert = db.prepare(
    `
    INSERT OR IGNORE INTO artists (
      source_artist_id,
      mbid,
      name,
      sort_name,
      disambiguation
    )
    VALUES (?, ?, ?, ?, ?)
    `
  );

  const insertBatch = db.transaction((rows) => {
    for (const row of rows) {
      insert.run(
        row.sourceArtistId,
        row.mbid,
        row.name,
        row.sortName,
        row.disambiguation
      );
    }
  });

  const rl = streamTar(DUMP_PATH, "mbdump/artist");
  let batch = [];
  let count = 0;
  let skipped = 0;

  for await (const line of rl) {
    if (!line.trim()) continue;

    const cols = line.split("\t");

    // artist:
    // 0 id, 1 gid/mbid, 2 name, 3 sort_name, ..., 13 comment
    if (cols.length < 4) {
      skipped++;
      continue;
    }

    const sourceArtistId = intOrNull(cols[0]);
    const mbid = nullIfMusicBrainzNull(cols[1]);
    const name = nullIfMusicBrainzNull(cols[2]);

    if (!sourceArtistId || !mbid || !name) {
      skipped++;
      continue;
    }

    batch.push({
      sourceArtistId,
      mbid,
      name,
      sortName: nullIfMusicBrainzNull(cols[3]),
      disambiguation: nullIfMusicBrainzNull(cols[13]),
    });

    if (batch.length >= BATCH_SIZE) {
      insertBatch(batch);
      count += batch.length;
      batch = [];

      if (count % 100000 === 0) {
        console.log(`[artists] ${count.toLocaleString()}`);
      }
    }
  }

  if (batch.length > 0) {
    insertBatch(batch);
    count += batch.length;
  }

  const totalArtists = db
    .prepare("SELECT COUNT(*) AS count FROM artists")
    .get().count;

  console.log("DONE loadArtists");
  console.log("Inserted/seen:", count.toLocaleString());
  console.log("Skipped:", skipped.toLocaleString());
  console.log("artists rows:", totalArtists.toLocaleString());

  db.close();
}

loadArtists().catch((error) => {
  console.error(error);
  process.exit(1);
});
