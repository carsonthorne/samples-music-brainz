const downloadArtwork = require("../../utils/downloadArtwork");
const { releaseGroupId } = require("../schema");

async function buildAlbumNode(graphDatabase, album) {

  const albumId = releaseGroupId(album.id);

  // Download artwork directly during backend compile execution
  const localArtworkPath = await downloadArtwork(album.id);

  graphDatabase.addNode({
    id: albumId,
    type: "release_group",
    name: album.title,
    mbid: album.id,
    // Saved as a relative static path (e.g., "/artwork/abc-123.jpg") or null
    artwork: localArtworkPath 
  });

  return albumId;
}

function linkArtistToAlbum(graphDatabase, artistId, albumId) {
  graphDatabase.addLink(artistId, albumId, "RELEASES");
}

module.exports = {
  buildAlbumNode,
  linkArtistToAlbum
};