const fetch = require("node-fetch");
const fetchWithCache = require("../../utils/fetchWithCache");

async function searchArtist(name) {
  const cacheKey = name.toLowerCase().replace(/\s+/g, "_");

  return fetchWithCache(
    "artists",
    cacheKey,
    async () => {
      console.log(
        `[API CALL] Searching artist: ${name}`
      );

      const url =
        `https://musicbrainz.org/ws/2/artist/?query=artist:${encodeURIComponent(name)}&fmt=json`;

      const res = await fetch(url, {
        headers: {
          "User-Agent": "my-app/1.0 ( your@email.com )"
        }
      });

      const data = await res.json();

      return data.artists[0];
    }
  );
}

module.exports = searchArtist;