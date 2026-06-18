const fetch = require("node-fetch");
const fetchWithCache = require("../../utils/fetchWithCache");

async function getAlbums(artistId) {

  return fetchWithCache(
    "albums",
    artistId,
    async () => {

      console.log(
        `[API CALL] Albums for artist ${artistId}`
      );

      const url = `https://musicbrainz.org/ws/2/release-group?artist=${artistId}&type=album&fmt=json`;

      const res = await fetch(url, {
        headers: {
          "User-Agent": "my-app/1.0 ( your@email.com )"
        }
      });

      const data = await res.json();

      return data["release-groups"];
    }
  );
}

module.exports = getAlbums;