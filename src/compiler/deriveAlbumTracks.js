const { initDb } = require("../db/initDb");

function deriveAlbumTracks() {
  console.log("Deriving album_tracks...");

  const db = initDb({
    mode: "build",
  });

  const before = db
    .prepare("SELECT COUNT(*) AS count FROM album_tracks")
    .get().count;

  db.exec(`
    INSERT OR IGNORE INTO album_tracks (
      album_id,
      track_id,
      position,
      track_number,
      title_on_release
    )
    SELECT
      albums.id,
      tracks.id,
      mb_tracks.position,
      mb_tracks.track_number,
      mb_tracks.title
    FROM mb_tracks
    JOIN mb_mediums
      ON mb_mediums.source_medium_id =
         mb_tracks.source_medium_id
    JOIN mb_releases
      ON mb_releases.source_release_id =
         mb_mediums.source_release_id
    JOIN albums
      ON albums.source_release_group_id =
         mb_releases.source_release_group_id
    JOIN tracks
      ON tracks.source_recording_id =
         mb_tracks.source_recording_id
  `);

  const after = db
    .prepare("SELECT COUNT(*) AS count FROM album_tracks")
    .get().count;

  console.log("DONE deriveAlbumTracks");
  console.log("album_tracks rows before:", before.toLocaleString());
  console.log("album_tracks rows after:", after.toLocaleString());
  console.log("new rows:", (after - before).toLocaleString());

  db.close();
}

try {
  deriveAlbumTracks();
} catch (error) {
  console.error(error);
  process.exit(1);
}
