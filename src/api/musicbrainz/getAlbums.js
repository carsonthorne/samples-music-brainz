const fetch = require("node-fetch");
const { readCache, writeCache } = require("../../utils/cache");

async function getAlbums(artistId) {
  const cached = readCache("albums", artistId);
  if (cached) {
    console.log(`[CACHE HIT] Albums for artist ${artistId}`);
    return cached;
  }

  console.log(`[API CALL] Fetching albums for artist ${artistId}`);

  const url = `https://musicbrainz.org/ws/2/release-group?artist=${artistId}&type=album&fmt=json`;

  const res = await fetch(url, {
    headers: {
      "User-Agent": "my-app/1.0 ( your@email.com )"
    }
  });

  const data = await res.json();
  const albums = data["release-groups"];

  writeCache("albums", artistId, albums);

  return albums;
}

module.exports = getAlbums;