// const fetch = require("node-fetch");

// async function searchArtist(name) {
//     const url = `https://musicbrainz.org/ws/2/artist/?query=artist:${encodeURIComponent(name)}&fmt=json`;

//     const res = await fetch(url, {
//         headers: {
//         "User-Agent": "my-music-app/1.0 ( your@email.com )"
//         }
//     });

//     const data = await res.json();

//     return data.artists[0];
// }

// module.exports = searchArtist;
const fetch = require("node-fetch");
const { readCache, writeCache } = require("../../utils/cache");

async function searchArtist(name) {
  const cacheKey = name.toLowerCase().replace(/\s+/g, "_");

  const cached = readCache("artists", cacheKey);
  if (cached) {
    console.log(`[CACHE HIT] Artist: ${name}`);
    return cached;
  }

  console.log(`[API CALL] Searching artist: ${name}`);

  const url = `https://musicbrainz.org/ws/2/artist/?query=artist:${encodeURIComponent(name)}&fmt=json`;

  const res = await fetch(url, {
    headers: {
      "User-Agent": "my-app/1.0 ( your@email.com )"
    }
  });

  const data = await res.json();
  const artist = data.artists[0];

  writeCache("artists", cacheKey, artist);

  return artist;
}

module.exports = searchArtist;