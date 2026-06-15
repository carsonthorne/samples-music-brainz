const searchArtist = require("../api/musicbrainz/searchArtist");
const getAlbums = require("../api/musicbrainz/getAlbums");
const getReleaseFromGroup = require("../api/musicbrainz/getReleaseFromGroup");
const getTracksFromRelease = require("../api/musicbrainz/getTracksFromRelease");
const getSamplesFromRecording = require("../api/musicbrainz/getSamplesFromRecording");
const {buildArtistNode} = require("./builders/artistBuilder") 
const {buildAlbumNode, linkArtistToAlbum } = require("./builders/albumBuilder");
const {buildTrackNode, linkAlbumToTrack} = require("./builders/trackBuilder");
const {buildSampleNode, linkTrackToSample, expandTrackSamples} = require("./builders/sampleBuilder");
const writeGraph = require("./graphWriter")

const GraphStore = require("./graphStore");

const LIMITS = 
{
  albumsPerArtist: 5,
  tracksPerAlbum: 15,
  sampleDepth: 1
};


function sleep(ms)
{
    return new Promise(r => setTimeout(r, ms));
}


async function buildGraph() 
{
  const graphStore = new GraphStore();

  // Store artist
  const artist = await searchArtist("a tribe called quest"); // Hardcoded for now (until search function is implemented)

  const artistId =
    buildArtistNode(
      graphStore,
      artist
    );


  // Store albums
  const albums = await getAlbums(artist.id);

  for (const album of albums.slice(0, LIMITS.albumsPerArtist))
  {
    const albumId = buildAlbumNode(graphStore, album);

    linkArtistToAlbum(graphStore, artistId, albumId);

    // Only get one version of the album (for now)
    const release = await getReleaseFromGroup(album.id);
    if (!release) continue;

    const tracks = await getTracksFromRelease(release.id);
    
    // Store Tracks
    for (const track of tracks)
    {
      const trackId = buildTrackNode(graphStore, track);

      linkAlbumToTrack(graphStore, albumId, trackId);

      // Store Samples
      await expandTrackSamples(
        graphStore,
        trackId,
        track.recordingId,
        0,
        LIMITS.sampleDepth,
        getSamplesFromRecording
      );

      await sleep(1000);
    }

    await sleep(1000);
  }

  // Build Graph
  writeGraph(graphStore.getGraph());

  console.log("Graph written to public/data/graph.json");
  console.log(graphStore.getGraph().nodes.length, graphStore.getGraph().links.length);
}

buildGraph();