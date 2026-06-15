function buildAlbumNode(graphStore, album) {
  const albumId = `album:${album.id}`;

  graphStore.addNode({
    id: albumId,
    type: "album",
    name: album.title,
    mbid: album.id
  });

  return albumId;
}

function linkArtistToAlbum(graphStore, artistId, albumId) {
  graphStore.addLink(artistId, albumId, "HAS_ALBUM");
}

module.exports = {
  buildAlbumNode,
  linkArtistToAlbum
};