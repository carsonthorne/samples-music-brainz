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


async function expandTrackSamples(
  graphStore,
  trackId,
  recordingId,
  depth,
  maxDepth,
  getSamplesFromRecording
)
{
  if (depth >= maxDepth)
  {
    return;
  }

  const samples =
    await getSamplesFromRecording(recordingId);

  for (const sample of samples)
  {
    const sampleId =
      buildSampleNode(graphStore, sample);

    linkTrackToSample(
      graphStore,
      trackId,
      sampleId
    );

    await expandTrackSamples(
      graphStore,
      sampleId,
      sample.id,
      depth + 1,
      maxDepth,
      getSamplesFromRecording
    );
  }
}






module.exports = {
  buildSampleNode,
  linkTrackToSample,
  expandTrackSamples
};