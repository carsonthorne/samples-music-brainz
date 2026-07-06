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

async function loadReleases() {
  console.log("Loading releases into SQLite...");
  console.log("Dump:", DUMP_PATH);

  const db = initDb({
    mode: "build",
  });

  const insert = db.prepare(
    `
    INSERT OR IGNORE INTO mb_releases (
      source_release_id,
      source_release_group_id
    )
    VALUES (?, ?)
    `
  );

  const insertBatch = db.transaction((rows) => {
    for (const row of rows) {
      insert.run(
        row.sourceReleaseId,
        row.sourceReleaseGroupId
      );
    }
  });

  const rl = streamTar(DUMP_PATH, "mbdump/release");
  let batch = [];
  let count = 0;
  let skipped = 0;

  for await (const line of rl) {
    if (!line.trim()) continue;

    const cols = line.split("\t");

    // release:
    // 0 id, 1 gid/mbid, 2 name, 3 artist_credit, 4 release_group
    if (cols.length < 5) {
      skipped++;
      continue;
    }

    const sourceReleaseId = intOrNull(cols[0]);
    const sourceReleaseGroupId = intOrNull(cols[4]);

    if (!sourceReleaseId || !sourceReleaseGroupId) {
      skipped++;
      continue;
    }

    batch.push({
      sourceReleaseId,
      sourceReleaseGroupId,
    });

    if (batch.length >= BATCH_SIZE) {
      insertBatch(batch);
      count += batch.length;
      batch = [];

      if (count % 100000 === 0) {
        console.log(`[releases] ${count.toLocaleString()}`);
      }
    }
  }

  if (batch.length > 0) {
    insertBatch(batch);
    count += batch.length;
  }

  const totalReleases = db
    .prepare("SELECT COUNT(*) AS count FROM mb_releases")
    .get().count;

  console.log("DONE loadReleases");
  console.log("Inserted/seen:", count.toLocaleString());
  console.log("Skipped:", skipped.toLocaleString());
  console.log("mb_releases rows:", totalReleases.toLocaleString());

  db.close();
}

loadReleases().catch((error) => {
  console.error(error);
  process.exit(1);
});
