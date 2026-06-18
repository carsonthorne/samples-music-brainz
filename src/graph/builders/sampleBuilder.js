const { buildArtistNode } = require("./artistBuilder");
const { buildAlbumNode, linkArtistToAlbum } = require("./albumBuilder");
const { linkAlbumToTrack } = require("./trackBuilder");
const getRecordingContextCachedMemory =
  require("../getRecordingContextCachedMemory");

function buildSampleNode(graphDatabase, sample) {
  const sampleId = `recording:${sample.id}`;

  graphDatabase.addNode({
    id: sampleId,
    type: "recording",
    name: sample.title || "Unknown Sample",
    mbid: sample.id
  });

  return sampleId;
}

function linkTrackToSample(graphDatabase, trackId, sampleId) {
  graphDatabase.addLink(trackId, sampleId, "USES_SAMPLE");
}

// Simple internal delay helper to protect your MusicBrainz rate limit
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function expandTrackSamples(
  graphDatabase,
  trackId,
  recordingId,
  depth,
  maxDepth,
  getSamplesFromRecording,
  getRecordingContext, // Pass this in from buildGraph
  visitedSamples
) {
  if (depth >= maxDepth) return;

  if (visitedSamples.has(recordingId)) {
    return;
  }

  const samples = await getSamplesFromRecording(recordingId);
  
  visitedSamples.add(recordingId);
  
  await sleep(1000); // Respect MusicBrainz 1 req/sec rule

  for (const sample of samples) {
    // Build and link the core sample recording node
    const sampleId = buildSampleNode(graphDatabase, sample);
    linkTrackToSample(graphDatabase, trackId, sampleId);

    // Fetch the upstream context (Album & Artist) for this sample
    try {
      // const context = await getRecordingContext(sample.id);
      const context =
        await getRecordingContextCachedMemory(
          sample.id,
          getRecordingContext
        );
      await sleep(1000); // Respect rate limits

      if (context && context.releaseId && context.artistId) {
        // Build Artist (Pass raw data; builder handles prefixing)
        const sampleArtistId = buildArtistNode(graphDatabase, {
          id: context.artistId,
          name: context.artistName
        });

        // Build Album (Pass raw data; builder handles prefixing)
        const sampleAlbumId = buildAlbumNode(graphDatabase, {
          id: context.releaseId,
          title: context.releaseTitle
        });

        // Establish the upstream relationships
        linkArtistToAlbum(graphDatabase, sampleArtistId, sampleAlbumId);
        linkAlbumToTrack(graphDatabase, sampleAlbumId, sampleId);
      }
    } catch (err) {
      console.error(`Failed to fetch context for recording ${sample.id}:`, err.message);
    }

    // Recurse deeper if allowed
    await expandTrackSamples(
      graphDatabase,
      sampleId,
      sample.id,
      depth + 1,
      maxDepth,
      getSamplesFromRecording,
      getRecordingContext,
      visitedSamples
    );
  }
}

module.exports = {
  buildSampleNode,
  linkTrackToSample,
  expandTrackSamples
};