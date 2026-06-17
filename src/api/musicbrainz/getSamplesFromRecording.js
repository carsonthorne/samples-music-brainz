const fetch = require("node-fetch");
const { readCache, writeCache } = require("../../utils/cache");

async function getSamplesFromRecording(recordingId) {
    const cached = readCache("samples", recordingId);
    if (cached) {
        console.log(`[CACHE HIT] Samples for recording ${recordingId}`);
        return cached;
    }

    console.log(`[API CALL] Fetching samples for recording ${recordingId}`);

    const url = `https://musicbrainz.org/ws/2/recording/${recordingId}?inc=recording-rels&fmt=json`;

    const res = await fetch(url, {
        headers: {
        "User-Agent": "my-app/1.0 ( your@email.com )"
        }
    });

    const data = await res.json();

    const samples = [];

    if (data.relations) {
            for (const rel of data.relations) {
            // DEBUG (optional)
            //     console.log(rel);
            // console.log(rel.type, rel.recording?.title);

            if (rel.type?.includes("sample") && rel.recording) {

                samples.push({
                    title: rel.recording.title,
                    id: rel.recording.id,
                    direction: rel.direction
                });
            }
        }



        
    }

    writeCache("samples", recordingId, samples);

    return samples;
}

module.exports = getSamplesFromRecording;