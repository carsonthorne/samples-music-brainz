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
        // console.log(JSON.stringify(data.relations, null, 2));

        // data.relations.forEach(rel => {
        //     // DEBUG: log what we're seeing
        //     console.log(rel);

        //     if (rel.type?.includes("sample")) { // use "sampled by" for sampled tracks
        //         console.log("sample found");
        //         samples.push({
        //         title: rel.recording.title,
        //         artist: rel.artist ? rel.artist.name : "Unknown"
        //         });
        //     }
        // });

        for (const rel of data.relations) {
            // DEBUG (optional)
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