function buildArtistNode(
  graphDatabase,
  artist
)
{
  const artistId =
    `artist:${artist.id}`;

  graphDatabase.addNode({
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