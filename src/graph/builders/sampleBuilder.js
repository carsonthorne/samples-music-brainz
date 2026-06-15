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

module.exports = {
  buildSampleNode,
  linkTrackToSample
};