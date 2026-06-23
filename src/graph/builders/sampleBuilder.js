const { buildArtistNode } = require("./artistBuilder");
const { buildAlbumNode, linkArtistToAlbum } = require("./albumBuilder");
const { linkAlbumToTrack } = require("./trackBuilder");
const getRecordingContextCachedMemory = require("../getRecordingContextCachedMemory");
const getSamplesFromRecording = require("../../api/musicbrainz/getSamplesFromRecording");
const getRecordingContext = require("../../api/musicbrainz/getRecordingContext");

function buildSampleNode(graphDatabase, sample) {
  return `track:${sample.id}`;
}

function linkTrackToSample(graphDatabase, trackId, sampleId) {
  graphDatabase.addLink(trackId, sampleId, "USES_SAMPLE");
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function expandTrackSamples({
    graphDatabase,
    parentTrackId,
    recordingId,
    depth,
    maxDepth,
    visitedRecordings,
}) 
{
  if (depth >= maxDepth) return;

  if (visitedRecordings.has(recordingId)) {
    console.log(`[CYCLE PREVENTED] ${recordingId}`);
    return;
  }

  const samples = await getSamplesFromRecording(recordingId);
  visitedRecordings.add(recordingId);

  await sleep(1000); 

  for (const sample of samples) {
    let context = null;
    
    try {
      context = await getRecordingContextCachedMemory(
        sample.id,
        getRecordingContext
      );
      await sleep(1000); 
    } catch (err) {
      console.error(`Failed to fetch context for recording ${sample.id}:`, err.message);
    }

    let sampleId = `track:${sample.id}`;
    let sampleAlbumId = null;

    if (context && context.releaseId) {
      sampleAlbumId = `album:${context.releaseId}`;
      
      // Look up if this album already contains a track with this name
      const existingTrackId = graphDatabase.getTrackIdByTitle(sampleAlbumId, sample.title);
      if (existingTrackId) {
        sampleId = existingTrackId; // Intercept and map to the pre-existing node!
        console.log(`[TRACK MERGED] Unified alternative recording of "${sample.title}" to match main node.`);
      } else {
        // If it doesn't exist yet, claim this ID for this title on this album
        graphDatabase.registerTrackTitle(sampleAlbumId, sample.title, sampleId);
      }
    }

    graphDatabase.addNode({
      id: sampleId,
      type: "track",
      name: sample.title || "Unknown Sample",
      mbid: sample.id
    });

    linkTrackToSample(graphDatabase, parentTrackId, sampleId);

    // Establish Upstream Context Relational Trees
    if (context && context.releaseId && context.artistId) {
      const sampleArtistId = await buildArtistNode(graphDatabase, {
        id: context.artistId,
        name: context.artistName
      });

      const sampleAlbumNodeId = await buildAlbumNode(graphDatabase, {
        id: context.releaseId,
        title: context.releaseTitle
      });

      linkArtistToAlbum(graphDatabase, sampleArtistId, sampleAlbumNodeId);
      linkAlbumToTrack(graphDatabase, sampleAlbumNodeId, sampleId);
    }

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
  buildSampleNode,
  linkTrackToSample,
  expandTrackSamples
};