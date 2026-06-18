function buildTrackNode(graphDatabase, track) {
  const trackId = `track:${track.recordingId}`;

  graphDatabase.addNode({
    id: trackId,
    type: "track",
    name: track.title,
    mbid: track.recordingId
  });

  return trackId;
}

function linkAlbumToTrack(graphDatabase, albumId, trackId) {
  graphDatabase.addLink(albumId, trackId, "HAS_TRACK");
}

module.exports = {
  buildTrackNode,
  linkAlbumToTrack
};