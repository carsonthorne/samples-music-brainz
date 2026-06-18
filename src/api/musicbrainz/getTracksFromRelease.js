const fetch = require("node-fetch");
const fetchWithCache = require("../../utils/fetchWithCache");

async function getTracksFromRelease(releaseId) {
  return fetchWithCache(
    "tracks",
    releaseId,
    async () => {
      console.log(
        `[API CALL] Fetching tracks for release ${releaseId}`
      );

      const url =
        `https://musicbrainz.org/ws/2/release/${releaseId}?inc=recordings&fmt=json`;

      const res = await fetch(url, {
        headers: {
          "User-Agent": "my-app/1.0 (your@email.com)"
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

      for (const medium of data.media) {
        for (const track of medium.tracks || []) {
          if (track?.recording?.id) {
            tracks.push({
              title: track.title,
              recordingId: track.recording.id
            });
          }
        }
      }

      return tracks;
    }
  );
}

module.exports = getTracksFromRelease;