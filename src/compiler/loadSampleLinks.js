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

async function findSampleLinkTypes() {
  const rl = streamTar(DUMP_PATH, "mbdump/link_type");
  const sampleTypes = [];

  for await (const line of rl) {
    if (!line.trim()) continue;

    const cols = line.split("\t");

    // link_type:
    // 0 id, 1 parent, 2 child_order, 3 gid/mbid,
    // 4 entity_type0, 5 entity_type1, 6 name,
    // 8 link_phrase, 9 reverse_link_phrase
    if (cols.length < 10) continue;

    const id = intOrNull(cols[0]);
    const entityType0 = nullIfMusicBrainzNull(cols[4]);
    const entityType1 = nullIfMusicBrainzNull(cols[5]);
    const name = nullIfMusicBrainzNull(cols[6]);

    if (
      id &&
      entityType0 === "recording" &&
      entityType1 === "recording" &&
      name === "samples material"
    ) {
      sampleTypes.push({
        id,
        name,
        linkPhrase: nullIfMusicBrainzNull(cols[8]),
        reverseLinkPhrase: nullIfMusicBrainzNull(cols[9]),
      });
    }
  }

  return sampleTypes;
}

async function loadSampleLinks() {
  console.log("Loading sample links into SQLite...");
  console.log("Dump:", DUMP_PATH);

  const sampleTypes = await findSampleLinkTypes();

  if (sampleTypes.length === 0) {
    throw new Error(
      "No recording-recording link_type named 'samples material' was found."
    );
  }

  console.log("Sample link types:");
  for (const type of sampleTypes) {
    console.log(
      `  id=${type.id} name="${type.name}" phrase="${type.linkPhrase}" reverse="${type.reverseLinkPhrase}"`
    );
  }

  const sampleTypeIds = new Set(sampleTypes.map((type) => type.id));

  const db = initDb({
    mode: "build",
  });

  const insert = db.prepare(
    `
    INSERT OR IGNORE INTO mb_sample_links (
      source_link_id,
      source_link_type_id,
      relationship_type
    )
    VALUES (?, ?, ?)
    `
  );

  const insertBatch = db.transaction((rows) => {
    for (const row of rows) {
      insert.run(
        row.sourceLinkId,
        row.sourceLinkTypeId,
        row.relationshipType
      );
    }
  });

  const rl = streamTar(DUMP_PATH, "mbdump/link");
  let batch = [];
  let count = 0;
  let matched = 0;
  let skipped = 0;

  for await (const line of rl) {
    if (!line.trim()) continue;

    const cols = line.split("\t");

    // link:
    // 0 id, 1 link_type, ...
    if (cols.length < 2) {
      skipped++;
      continue;
    }

    const sourceLinkId = intOrNull(cols[0]);
    const sourceLinkTypeId = intOrNull(cols[1]);

    if (!sourceLinkId || !sourceLinkTypeId) {
      skipped++;
      continue;
    }

    count++;

    if (!sampleTypeIds.has(sourceLinkTypeId)) {
      continue;
    }

    batch.push({
      sourceLinkId,
      sourceLinkTypeId,
      relationshipType: "samples material",
    });

    matched++;

    if (batch.length >= BATCH_SIZE) {
      insertBatch(batch);
      batch = [];
    }

    if (matched % 10000 === 0) {
      console.log(`[sample_links] ${matched.toLocaleString()}`);
    }
  }

  if (batch.length > 0) {
    insertBatch(batch);
  }

  const totalSampleLinks = db
    .prepare("SELECT COUNT(*) AS count FROM mb_sample_links")
    .get().count;

  console.log("DONE loadSampleLinks");
  console.log("Links scanned:", count.toLocaleString());
  console.log("Sample links matched:", matched.toLocaleString());
  console.log("Skipped:", skipped.toLocaleString());
  console.log("mb_sample_links rows:", totalSampleLinks.toLocaleString());

  db.close();
}

loadSampleLinks().catch((error) => {
  console.error(error);
  process.exit(1);
});
