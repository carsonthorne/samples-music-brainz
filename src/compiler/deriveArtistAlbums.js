const { initDb } = require("../db/initDb");

function deriveArtistAlbums() {
  console.log("Deriving artist_albums...");

  const db = initDb({
    mode: "build",
  });

  const before = db
    .prepare("SELECT COUNT(*) AS count FROM artist_albums")
    .get().count;

  db.exec(`
    INSERT OR IGNORE INTO artist_albums (
      artist_id,
      album_id
    )
    SELECT
      artists.id,
      albums.id
    FROM albums
    JOIN mb_artist_credit_names
      ON mb_artist_credit_names.source_artist_credit_id =
         albums.source_artist_credit_id
    JOIN artists
      ON artists.source_artist_id =
         mb_artist_credit_names.source_artist_id
  `);

  const after = db
    .prepare("SELECT COUNT(*) AS count FROM artist_albums")
    .get().count;

  console.log("DONE deriveArtistAlbums");
  console.log("artist_albums rows before:", before.toLocaleString());
  console.log("artist_albums rows after:", after.toLocaleString());
  console.log("new rows:", (after - before).toLocaleString());

  db.close();
}

try {
  deriveArtistAlbums();
} catch (error) {
  console.error(error);
  process.exit(1);
}
