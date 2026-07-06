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

async function loadMediums() {
  console.log("Loading mediums into SQLite...");
  console.log("Dump:", DUMP_PATH);

  const db = initDb({
    mode: "build",
  });

  const insert = db.prepare(
    `
    INSERT OR IGNORE INTO mb_mediums (
      source_medium_id,
      source_release_id
    )
    VALUES (?, ?)
    `
  );

  const insertBatch = db.transaction((rows) => {
    for (const row of rows) {
      insert.run(
        row.sourceMediumId,
        row.sourceReleaseId
      );
    }
  });

  const rl = streamTar(DUMP_PATH, "mbdump/medium");
  let batch = [];
  let count = 0;
  let skipped = 0;

  for await (const line of rl) {
    if (!line.trim()) continue;

    const cols = line.split("\t");

    // medium:
    // 0 id, 1 release, ...
    if (cols.length < 2) {
      skipped++;
      continue;
    }

    const sourceMediumId = intOrNull(cols[0]);
    const sourceReleaseId = intOrNull(cols[1]);

    if (!sourceMediumId || !sourceReleaseId) {
      skipped++;
      continue;
    }

    batch.push({
      sourceMediumId,
      sourceReleaseId,
    });

    if (batch.length >= BATCH_SIZE) {
      insertBatch(batch);
      count += batch.length;
      batch = [];

      if (count % 100000 === 0) {
        console.log(`[mediums] ${count.toLocaleString()}`);
      }
    }
  }

  if (batch.length > 0) {
    insertBatch(batch);
    count += batch.length;
  }

  const totalMediums = db
    .prepare("SELECT COUNT(*) AS count FROM mb_mediums")
    .get().count;

  console.log("DONE loadMediums");
  console.log("Inserted/seen:", count.toLocaleString());
  console.log("Skipped:", skipped.toLocaleString());
  console.log("mb_mediums rows:", totalMediums.toLocaleString());

  db.close();
}

loadMediums().catch((error) => {
  console.error(error);
  process.exit(1);
});
