const searchArtist = require("../api/musicbrainz/searchArtist");
const getAlbums = require("../api/musicbrainz/getAlbums");
const getReleaseFromGroup = require("../api/musicbrainz/getReleaseFromGroup");
const getTracksFromRelease = require("../api/musicbrainz/getTracksFromRelease");
const { buildArtistNode } = require("./builders/artistBuilder");
const {
  buildAlbumNode,
  linkArtistToAlbum,
} = require("./builders/albumBuilder");
const { buildTrackNode, linkAlbumToTrack } = require("./builders/trackBuilder");
const { expandTrackSamples } = require("./builders/sampleBuilder");
const writeGraph = require("./graphWriter");

const GraphDatabase = require("./graphDatabase");

const LIMITS = {
  albumsPerArtist: 2,
  sampleDepth: 1,
};

async function buildArtistGraph(artistName, limits = LIMITS) {
  const db = new GraphDatabase();

  const visitedRecordings = new Set();

  // Store Root Artist
  const artist = await searchArtist(artistName);
  const artistId = await buildArtistNode(db, artist);

  // Store albums
  const albums = await getAlbums(artist.id);

  for (const album of albums.slice(0, limits.albumsPerArtist)) {
    const albumId = await buildAlbumNode(db, album);
    linkArtistToAlbum(db, artistId, albumId);

    const release = await getReleaseFromGroup(album.id);

    if (!release) {
      console.warn(`[MISSING RELEASE] ${album.id}`);
      continue;
    }

    const tracks = await getTracksFromRelease(release.id);

    for (const track of tracks) {

      if (!track.recordingId) {
        console.warn("Skipping track without recordingId", track);
        continue;
      }

      const trackId = buildTrackNode(db, track, albumId);
      linkAlbumToTrack(db, albumId, trackId);

      await expandTrackSamples({
        graphDatabase: db,
        parentTrackId: trackId,
        recordingId: track.recordingId,
        depth: 0,
        maxDepth: limits.sampleDepth,
        visitedRecordings: visitedRecordings,
      });
    }
  }

  const graph = db.getGraph();

  console.log(`Nodes: ${graph.nodes.length}`);
  console.log(`Links: ${graph.links.length}`);
  console.log(`Artist: ${artist.name}`);
  console.log(
    `Albums processed: ${
      Math.min(
        albums.length,
        limits.albumsPerArtist
      )
    }`
  );

  writeGraph(graph);
  console.log("Graph written successfully!");
}

buildArtistGraph("A Tribe Called Quest");

module.exports = {
  buildArtistGraph,
};
