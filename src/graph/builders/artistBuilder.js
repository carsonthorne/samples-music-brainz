const downloadArtistAvatar = require("../../utils/downloadArtistAvatar");

async function buildArtistNode(
  graphDatabase,
  artist
)
{
  const artistId =
    `artist:${artist.id}`;

  const localAvatar = await downloadArtistAvatar(artist.id);

  graphDatabase.addNode({
    id: artistId,
    type: "artist",
    name: artist.name,
    mbid: artist.id,
    avatar: localAvatar
  });

  return artistId;
}

module.exports = {
  buildArtistNode
};