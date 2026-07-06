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

async function loadAlbums() {
  console.log("Loading release groups as albums into SQLite...");
  console.log("Dump:", DUMP_PATH);

  const db = initDb({
    mode: "build",
  });

  const insert = db.prepare(
    `
    INSERT OR IGNORE INTO albums (
      source_release_group_id,
      mbid,
      source_artist_credit_id,
      title,
      first_release_date,
      type,
      disambiguation
    )
    VALUES (?, ?, ?, ?, ?, ?, ?)
    `
  );

  const insertBatch = db.transaction((rows) => {
    for (const row of rows) {
      insert.run(
        row.sourceReleaseGroupId,
        row.mbid,
        row.sourceArtistCreditId,
        row.title,
        row.firstReleaseDate,
        row.type,
        row.disambiguation
      );
    }
  });

  const rl = streamTar(DUMP_PATH, "mbdump/release_group");
  let batch = [];
  let count = 0;
  let skipped = 0;

  for await (const line of rl) {
    if (!line.trim()) continue;

    const cols = line.split("\t");

    // release_group:
    // 0 id, 1 gid/mbid, 2 name, 3 artist_credit, 4 type, 5 comment
    if (cols.length < 4) {
      skipped++;
      continue;
    }

    const sourceReleaseGroupId = intOrNull(cols[0]);
    const mbid = nullIfMusicBrainzNull(cols[1]);
    const title = nullIfMusicBrainzNull(cols[2]);

    if (!sourceReleaseGroupId || !mbid || !title) {
      skipped++;
      continue;
    }

    batch.push({
      sourceReleaseGroupId,
      mbid,
      title,
      sourceArtistCreditId: intOrNull(cols[3]),
      firstReleaseDate: null,
      type: nullIfMusicBrainzNull(cols[4]),
      disambiguation: nullIfMusicBrainzNull(cols[5]),
    });

    if (batch.length >= BATCH_SIZE) {
      insertBatch(batch);
      count += batch.length;
      batch = [];

      if (count % 100000 === 0) {
        console.log(`[albums] ${count.toLocaleString()}`);
      }
    }
  }

  if (batch.length > 0) {
    insertBatch(batch);
    count += batch.length;
  }

  const totalAlbums = db
    .prepare("SELECT COUNT(*) AS count FROM albums")
    .get().count;

  console.log("DONE loadAlbums");
  console.log("Inserted/seen:", count.toLocaleString());
  console.log("Skipped:", skipped.toLocaleString());
  console.log("albums rows:", totalAlbums.toLocaleString());

  db.close();
}

loadAlbums().catch((error) => {
  console.error(error);
  process.exit(1);
});
