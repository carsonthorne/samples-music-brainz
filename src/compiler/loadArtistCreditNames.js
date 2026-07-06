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

async function loadArtistCreditNames() {
  console.log("Loading artist credit names into SQLite...");
  console.log("Dump:", DUMP_PATH);

  const db = initDb({
    mode: "build",
  });

  const insert = db.prepare(
    `
    INSERT OR IGNORE INTO mb_artist_credit_names (
      source_artist_credit_id,
      source_artist_id,
      position,
      name,
      join_phrase
    )
    VALUES (?, ?, ?, ?, ?)
    `
  );

  const insertBatch = db.transaction((rows) => {
    for (const row of rows) {
      insert.run(
        row.sourceArtistCreditId,
        row.sourceArtistId,
        row.position,
        row.name,
        row.joinPhrase
      );
    }
  });

  const rl = streamTar(DUMP_PATH, "mbdump/artist_credit_name");
  let batch = [];
  let count = 0;
  let skipped = 0;

  for await (const line of rl) {
    if (!line.trim()) continue;

    const cols = line.split("\t");

    // artist_credit_name:
    // 0 artist_credit, 1 position, 2 artist, 3 name, 4 join_phrase
    if (cols.length < 5) {
      skipped++;
      continue;
    }

    const sourceArtistCreditId = intOrNull(cols[0]);
    const position = intOrNull(cols[1]);
    const sourceArtistId = intOrNull(cols[2]);

    if (
      !sourceArtistCreditId ||
      position === null ||
      !sourceArtistId
    ) {
      skipped++;
      continue;
    }

    batch.push({
      sourceArtistCreditId,
      position,
      sourceArtistId,
      name: nullIfMusicBrainzNull(cols[3]),
      joinPhrase: nullIfMusicBrainzNull(cols[4]),
    });

    if (batch.length >= BATCH_SIZE) {
      insertBatch(batch);
      count += batch.length;
      batch = [];

      if (count % 100000 === 0) {
        console.log(`[artist_credit_names] ${count.toLocaleString()}`);
      }
    }
  }

  if (batch.length > 0) {
    insertBatch(batch);
    count += batch.length;
  }

  const totalArtistCreditNames = db
    .prepare("SELECT COUNT(*) AS count FROM mb_artist_credit_names")
    .get().count;

  console.log("DONE loadArtistCreditNames");
  console.log("Inserted/seen:", count.toLocaleString());
  console.log("Skipped:", skipped.toLocaleString());
  console.log(
    "mb_artist_credit_names rows:",
    totalArtistCreditNames.toLocaleString()
  );

  db.close();
}

loadArtistCreditNames().catch((error) => {
  console.error(error);
  process.exit(1);
});
