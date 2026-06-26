const getRecordingContextCachedMemory = require("../getRecordingContextCachedMemory");
const getSamplesFromRecording = require("../../api/musicbrainz/getSamplesFromRecording");
const getRecordingContext = require("../../api/musicbrainz/getRecordingContext");
const { recordingId } = require("../schema");


async function expandTrackSamples({
    graphDatabase,
    parentTrackId,
    recordingId: currentRecordingId,
    depth,
    maxDepth,
    visitedRecordings,
}) 
{
  if (depth >= maxDepth) return;

  if (visitedRecordings.has(currentRecordingId)) {
    console.log(`[CYCLE PREVENTED] ${currentRecordingId}`);
    return;
  }

  visitedRecordings.add(currentRecordingId);
  const samples = await getSamplesFromRecording(currentRecordingId);


  for (const sample of samples) {

    let sampleId = recordingId(sample.id);

    graphDatabase.addNode({
      id: sampleId,
      type: "track",
      name: sample.title || "Unknown Sample",
      mbid: sample.id
    });

    graphDatabase.addLink(parentTrackId, sampleId, "SAMPLES");

    // Recurse deeper
    await expandTrackSamples({
      graphDatabase,
      parentTrackId: sampleId,
      recordingId: sample.id,
      depth: depth + 1,
      maxDepth,
      visitedRecordings,
    });
  }
}

module.exports = {
  expandTrackSamples
};