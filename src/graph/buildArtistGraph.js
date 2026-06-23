const searchArtist = require("../api/musicbrainz/searchArtist");
const getAlbums = require("../api/musicbrainz/getAlbums");
const getReleaseFromGroup = require("../api/musicbrainz/getReleaseFromGroup");
const getTracksFromRelease = require("../api/musicbrainz/getTracksFromRelease");
const getSamplesFromRecording = require("../api/musicbrainz/getSamplesFromRecording");
const getRecordingContext = require("../api/musicbrainz/getRecordingContext");
const { buildArtistNode } = require("./builders/artistBuilder");
const { buildAlbumNode, linkArtistToAlbum } = require("./builders/albumBuilder");
const { buildTrackNode, linkAlbumToTrack } = require("./builders/trackBuilder");
const { expandTrackSamples } = require("./builders/sampleBuilder");
const writeGraph = require("./graphWriter");

const GraphDatabase = require("./graphDatabase");

const LIMITS = {
  albumsPerArtist: 5,
  sampleDepth: 1
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function buildArtistGraph(
  artistName,
  limits = LIMITS
) 
{
  const db = new GraphDatabase();

  const visitedRecordings = new Set();

  // Store Root Artist
  const artist = await searchArtist(artistName);
  const artistId = await buildArtistNode(db, artist);
  await sleep(1000);

  // Store albums
  const albums = await getAlbums(artist.id);
  await sleep(1000);

  for (const album of albums.slice(0, LIMITS.albumsPerArtist))
  {
    const albumId = await buildAlbumNode(db, album);
    linkArtistToAlbum(db, artistId, albumId);

    const release = await getReleaseFromGroup(album.id);
    await sleep(1000);
    if (!release) continue;

    const tracks = await getTracksFromRelease(release.id);
    await sleep(1000);
    
    for (const track of tracks) {
      const trackId = buildTrackNode(db, track, albumId);
      linkAlbumToTrack(db, albumId, trackId);

      await expandTrackSamples({
        graphDatabase: db,
        parentTrackId: trackId,
        recordingId: track.recordingId,
        depth: 0,
        maxDepth: LIMITS.sampleDepth,
        visitedRecordings: visitedRecordings
      });
    }
  }

  const graph = db.getGraph();

  console.log(
    `Nodes: ${graph.nodes.length}`
  );

  console.log(
    `Links: ${graph.links.length}`
  );

  writeGraph(graph);
  console.log("Graph written successfully!");
}

buildArtistGraph();

module.exports =
{
  buildArtistGraph
};