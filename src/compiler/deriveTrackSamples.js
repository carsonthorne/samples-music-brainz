const { initDb } = require("../db/initDb");

function deriveTrackSamples() {
  console.log("Deriving track_samples...");

  const db = initDb({
    mode: "build",
  });

  const before = db
    .prepare("SELECT COUNT(*) AS count FROM track_samples")
    .get().count;

  db.exec(`
    INSERT OR IGNORE INTO track_samples (
      track_id,
      sampled_track_id,
      relationship_type
    )
    SELECT
      source_tracks.id,
      sampled_tracks.id,
      mb_sample_edges.relationship_type
    FROM mb_sample_edges
    JOIN tracks AS source_tracks
      ON source_tracks.source_recording_id =
         mb_sample_edges.source_recording_id
    JOIN tracks AS sampled_tracks
      ON sampled_tracks.source_recording_id =
         mb_sample_edges.sampled_recording_id
  `);

  const after = db
    .prepare("SELECT COUNT(*) AS count FROM track_samples")
    .get().count;

  console.log("DONE deriveTrackSamples");
  console.log("track_samples rows before:", before.toLocaleString());
  console.log("track_samples rows after:", after.toLocaleString());
  console.log("new rows:", (after - before).toLocaleString());

  db.close();
}

try {
  deriveTrackSamples();
} catch (error) {
  console.error(error);
  process.exit(1);
}
