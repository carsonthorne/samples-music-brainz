const fetch = require("node-fetch");
const fetchWithCache = require("../../utils/fetchWithCache");

async function getRecordingContext(recordingId)
{
  return fetchWithCache(
    "recordingContexts",
    recordingId,
    async () => {
      console.log(
        `[API CALL] Fetching recording context ${recordingId}`
      );

      const url =
        `https://musicbrainz.org/ws/2/recording/${recordingId}?inc=releases+release-groups+artist-credits&fmt=json`;

      const res = await fetch(url, {
        headers: {
          "User-Agent": "my-app/1.0 (your@email.com)"
        }
      });

      const data = await res.json();

      const release = data["releases"]?.[0];

      const releaseGroup = release?.["release-group"];

      const artist = data["artist-credit"]?.[0]?.artist || null;

      const context =  {
        recordingId,
        releaseId: releaseGroup?.id || release?.id,
        releaseTitle: release?.title,
        artistId: artist?.id,
        artistName: artist?.name
      };

      return context;
    }
  );
}

module.exports = getRecordingContext;