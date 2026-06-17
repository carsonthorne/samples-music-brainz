const fetch = require("node-fetch");
const { readCache, writeCache } = require("../../utils/cache");

async function getTracksFromRelease(releaseId) {
  const cached = readCache("tracks", releaseId);
  if (cached) {
    console.log(`[CACHE HIT] Tracks for release ${releaseId}`);
    return cached;
  }

  console.log(`[API CALL] Fetching tracks for release ${releaseId}`);

  const url = `https://musicbrainz.org/ws/2/release/${releaseId}?inc=recordings&fmt=json`;

  const res = await fetch(url, {
    headers: {
      "User-Agent": "my-app/1.0 ( your@email.com )"
    }
  });

  const data = await res.json();

  if (!data.media) {
    console.warn(
      `No media found for release ${releaseId}`
    );

    return [];
  }

  const tracks = [];

  data.media.forEach(medium => {
    medium.tracks.forEach(track => {
      tracks.push({
        title: track.title,
        recordingId: track.recording.id
      });
    });
  });

  writeCache("tracks", releaseId, tracks);

  return tracks;
}

module.exports = getTracksFromRelease;