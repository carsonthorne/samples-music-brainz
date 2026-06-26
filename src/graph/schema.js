const NODE_TYPES = {
  ARTIST: "artist",
  RELEASE_GROUP: "release_group",
  RELEASE: "release",
  RECORDING: "recording",
};

function artistId(id) {
  return `artist:${id}`;
}

function releaseGroupId(id) {
  return `release_group:${id}`;
}

function releaseId(id) {
  return `release:${id}`;
}

function recordingId(id) {
  return `track:${id}`;
}

module.exports = {
  NODE_TYPES,
  artistId,
  releaseGroupId,
  releaseId,
  recordingId,
};