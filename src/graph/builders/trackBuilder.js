function buildTrackNode(graphStore, track) {
  const trackId = `track:${track.recordingId}`;

  graphStore.addNode({
    id: trackId,
    type: "track",
    name: track.title,
    mbid: track.recordingId
  });

  return trackId;
}

function linkAlbumToTrack(graphStore, albumId, trackId) {
  graphStore.addLink(albumId, trackId, "HAS_TRACK");
}

module.exports = {
  buildTrackNode,
  linkAlbumToTrack
};