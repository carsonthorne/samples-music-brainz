function buildAlbumNode(graphDatabase, album) {
  const albumId = `album:${album.id}`;

  graphDatabase.addNode({
    id: albumId,
    type: "album",
    name: album.title,
    mbid: album.id
  });

  return albumId;
}

function linkArtistToAlbum(graphDatabase, artistId, albumId) {
  graphDatabase.addLink(artistId, albumId, "HAS_ALBUM");
}

module.exports = {
  buildAlbumNode,
  linkArtistToAlbum
};