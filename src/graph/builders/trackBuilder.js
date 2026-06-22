function buildTrackNode(graphDatabase, track, albumId) {
  
  const existingTrackId = graphDatabase.getTrackIdByTitle(albumId, track.title);
  
  if (existingTrackId)
  {
    return existingTrackId;
  }

  const trackId = `track:${track.recordingId}`;

  graphDatabase.addNode({
    id: trackId,
    type: "track",
    name: track.title,
    mbid: track.recordingId
  });

  graphDatabase.registerTrackTitle(albumId, track.title, trackId);

  return trackId;
}

function linkAlbumToTrack(graphDatabase, albumId, trackId) {
  graphDatabase.addLink(albumId, trackId, "HAS_TRACK");
}

module.exports = {
  buildTrackNode,
  linkAlbumToTrack
};