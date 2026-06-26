const { recordingId } = require("../schema");

function buildTrackNode(graphDatabase, track, albumId) {

  const trackId = recordingId(track.recordingId);

  graphDatabase.addNode({
    id: trackId,
    type: "track",
    name: track.title,
    mbid: track.recordingId
  });

  return trackId;
}

function linkAlbumToTrack(graphDatabase, albumId, trackId) {
  graphDatabase.addLink(albumId, trackId, "CONTAINS");
}

module.exports = {
  buildTrackNode,
  linkAlbumToTrack
};