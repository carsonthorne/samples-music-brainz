const downloadArtwork = require("../../utils/downloadArtwork");

async function buildAlbumNode(graphDatabase, album) {
  const albumId = `album:${album.id}`;

  // Download artwork directly during backend compile execution
  const localArtworkPath = await downloadArtwork(album.id);

  graphDatabase.addNode({
    id: albumId,
    type: "album",
    name: album.title,
    mbid: album.id,
    // Saved as a relative static path (e.g., "/artwork/abc-123.jpg") or null
    artwork: localArtworkPath 
  });

  return albumId;
}

function linkArtistToAlbum(graphDatabase, artistId, albumId) {
  graphDatabase.addLink(artistId, albumId, "RELEASES_ALBUM");
}

module.exports = {
  buildAlbumNode,
  linkArtistToAlbum
};