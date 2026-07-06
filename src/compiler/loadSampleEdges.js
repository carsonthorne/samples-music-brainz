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

async function loadSampleEdges() {
  console.log("Loading sample recording edges into SQLite...");
  console.log("Dump:", DUMP_PATH);

  const db = initDb({
    mode: "build",
  });

  const sampleLinks = db
    .prepare(
      `
      SELECT source_link_id, relationship_type
      FROM mb_sample_links
      `
    )
    .all();

  if (sampleLinks.length === 0) {
    throw new Error(
      "mb_sample_links is empty. Run loadSampleLinks.js before loadSampleEdges.js."
    );
  }

  const sampleLinksById = new Map(
    sampleLinks.map((row) => [row.source_link_id, row.relationship_type])
  );

  console.log("Sample link ids loaded:", sampleLinksById.size.toLocaleString());

  const insert = db.prepare(
    `
    INSERT OR IGNORE INTO mb_sample_edges (
      source_recording_id,
      sampled_recording_id,
      relationship_type
    )
    VALUES (?, ?, ?)
    `
  );

  const insertBatch = db.transaction((rows) => {
    for (const row of rows) {
      insert.run(
        row.sourceRecordingId,
        row.sampledRecordingId,
        row.relationshipType
      );
    }
  });

  const rl = streamTar(DUMP_PATH, "mbdump/l_recording_recording");
  let batch = [];
  let count = 0;
  let matched = 0;
  let skipped = 0;

  for await (const line of rl) {
    if (!line.trim()) continue;

    const cols = line.split("\t");

    // l_recording_recording:
    // 0 id, 1 link, 2 entity0, 3 entity1, ...
    //
    // For "samples material", entity0 samples material from entity1.
    if (cols.length < 4) {
      skipped++;
      continue;
    }

    const linkId = intOrNull(cols[1]);

    count++;

    if (!linkId || !sampleLinksById.has(linkId)) {
      continue;
    }

    const sourceRecordingId = intOrNull(cols[2]);
    const sampledRecordingId = intOrNull(cols[3]);

    if (!sourceRecordingId || !sampledRecordingId) {
      skipped++;
      continue;
    }

    batch.push({
      sourceRecordingId,
      sampledRecordingId,
      relationshipType: sampleLinksById.get(linkId),
    });

    matched++;

    if (batch.length >= BATCH_SIZE) {
      insertBatch(batch);
      batch = [];
    }

    if (matched % 10000 === 0) {
      console.log(`[sample_edges] ${matched.toLocaleString()}`);
    }
  }

  if (batch.length > 0) {
    insertBatch(batch);
  }

  const totalSampleEdges = db
    .prepare("SELECT COUNT(*) AS count FROM mb_sample_edges")
    .get().count;

  console.log("DONE loadSampleEdges");
  console.log("Recording-recording rows scanned:", count.toLocaleString());
  console.log("Sample edges matched:", matched.toLocaleString());
  console.log("Skipped:", skipped.toLocaleString());
  console.log("mb_sample_edges rows:", totalSampleEdges.toLocaleString());

  db.close();
}

loadSampleEdges().catch((error) => {
  console.error(error);
  process.exit(1);
});
