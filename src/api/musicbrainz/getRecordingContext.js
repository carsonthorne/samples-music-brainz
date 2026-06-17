const fetch = require("node-fetch");

async function getRecordingContext(recordingId)
{
  console.log(`[API CALL] Fetching recording context ${recordingId}`);

  const url =
    `https://musicbrainz.org/ws/2/recording/${recordingId}?inc=releases+artist-credits&fmt=json`;

  const res = await fetch(url, {
    headers: {
      "User-Agent": "my-app/1.0 (your@email.com)"
    }
  });

  const data = await res.json();

  const release = data["releases"]?.[0];
  const artist = data["artist-credit"]?.[0]?.artist;

  return {
    recordingId,
    releaseId: release?.id,
    releaseTitle: release?.title,
    artistId: artist?.id,
    artistName: artist?.name
  };
}

module.exports = getRecordingContext;