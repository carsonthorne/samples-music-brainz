const fetch = require("node-fetch");
const fetchWithCache = require("../../utils/fetchWithCache");

async function getSamplesFromRecording(recordingId) {
  return fetchWithCache(
    "samples",
    recordingId,
    async () => {
      console.log(
        `[API CALL] Fetching samples for recording ${recordingId}`
      );

      const url =
        `https://musicbrainz.org/ws/2/recording/${recordingId}?inc=recording-rels&fmt=json`;

      const res = await fetch(url, {
        headers: {
          "User-Agent": "my-app/1.0 (your@email.com)"
        }
      });

      const data = await res.json();

      const samples = [];

      const relations = data.relations || [];

      for (const rel of relations) {
        // console.log(rel);
        // console.log(rel.type, rel.recording?.title);
        const isSample =
          rel.type?.toLowerCase().includes("sample");

        const hasRecording =
          rel.recording?.id;

        if (isSample && hasRecording) {
          samples.push({
            title: rel.recording.title,
            id: rel.recording.id,
            direction: rel.direction
          });
        }
      }

      return samples;
    }
  );
}

module.exports = getSamplesFromRecording;