function buildArtistNode(
  graphStore,
  artist
)
{
  const artistId =
    `artist:${artist.id}`;

  graphStore.addNode({
    id: artistId,
    type: "artist",
    name: artist.name,
    mbid: artist.id
  });

  return artistId;
}

module.exports = {
  buildArtistNode
};