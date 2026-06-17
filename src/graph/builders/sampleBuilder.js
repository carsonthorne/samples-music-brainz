const { buildArtistNode } = require("./artistBuilder");
const { buildAlbumNode, linkArtistToAlbum } = require("./albumBuilder");
const { linkAlbumToTrack } = require("./trackBuilder");

function buildSampleNode(graphStore, sample) {
  const sampleId = `recording:${sample.id}`;

  graphStore.addNode({
    id: sampleId,
    type: "recording",
    name: sample.title || "Unknown Sample",
    mbid: sample.id
  });

  return sampleId;
}

function linkTrackToSample(graphStore, trackId, sampleId) {
  graphStore.addLink(trackId, sampleId, "USES_SAMPLE");
}

// Simple internal delay helper to protect your MusicBrainz rate limit
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function expandTrackSamples(
  graphStore,
  trackId,
  recordingId,
  depth,
  maxDepth,
  getSamplesFromRecording,
  getRecordingContext // Pass this in from buildGraph
) {
  if (depth >= maxDepth) return;

  const samples = await getSamplesFromRecording(recordingId);
  await sleep(1000); // Respect MusicBrainz 1 req/sec rule

  for (const sample of samples) {
    // Build and link the core sample recording node
    const sampleId = buildSampleNode(graphStore, sample);
    linkTrackToSample(graphStore, trackId, sampleId);

    // Fetch the upstream context (Album & Artist) for this sample
    try {
      const context = await getRecordingContext(sample.id);
      await sleep(1000); // Respect rate limits

      if (context && context.releaseId && context.artistId) {
        // Build Artist (Pass raw data; builder handles prefixing)
        const sampleArtistId = buildArtistNode(graphStore, {
          id: context.artistId,
          name: context.artistName
        });

        // Build Album (Pass raw data; builder handles prefixing)
        const sampleAlbumId = buildAlbumNode(graphStore, {
          id: context.releaseId,
          title: context.releaseTitle
        });

        // Establish the upstream relationships
        linkArtistToAlbum(graphStore, sampleArtistId, sampleAlbumId);
        linkAlbumToTrack(graphStore, sampleAlbumId, sampleId);
      }
    } catch (err) {
      console.error(`Failed to fetch context for recording ${sample.id}:`, err.message);
    }

    // Recurse deeper if allowed
    await expandTrackSamples(
      graphStore,
      sampleId,
      sample.id,
      depth + 1,
      maxDepth,
      getSamplesFromRecording,
      getRecordingContext
    );
  }
}

module.exports = {
  buildSampleNode,
  linkTrackToSample,
  expandTrackSamples
};