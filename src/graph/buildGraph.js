  const fs = require("fs");
  const path = require("path");

const searchArtist = require("../api/musicbrainz/searchArtist");
const getAlbums = require("../api/musicbrainz/getAlbums");
const getReleaseFromGroup = require("../api/musicbrainz/getReleaseFromGroup");
const getTracksFromRelease = require("../api/musicbrainz/getTracksFromRelease");
const getSamplesFromRecording = require("../api/musicbrainz/getSamplesFromRecording");
const {buildAlbumNode, linkArtistToAlbum } = require("./builders/albumBuilder");
const {buildTrackNode, linkAlbumToTrack} = require("./builders/trackBuilder");
const {buildSampleNode, linkTrackToSample} = require("./builders/sampleBuilder");

const GraphStore = require("./graphStore");

const LIMITS = 
{
  albumsPerArtist: 5,
  tracksPerAlbum: 15,
  sampleDepth: 1
};


async function addTrackSamples(
  graphStore,
  trackId,
  recordingId,
  depth
) 
{
  if (depth >= LIMITS.sampleDepth) 
  {
    return;
  }

  const samples = await getSamplesFromRecording(recordingId);

  for (const sample of samples)
  {
    const sampleId = buildSampleNode(graphStore, sample);

    linkTrackToSample(graphStore, trackId, sampleId);



    await addTrackSamples(graphStore, sampleId, sample.id, depth + 1);
  }
}


function sleep(ms)
{
    return new Promise(r => setTimeout(r, ms));
}


async function buildGraph() 
{
  const graphStore = new GraphStore();

  // Store artist
  const artist = await searchArtist("a tribe called quest"); // Hardcoded for now (until search function is implemented)
  const artistId = `artist:${artist.id}`;
  
  graphStore.addNode({
    id: artistId,
    type: "artist",
    name: artist.name,
    mbid: artist.id
  });

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
      await addTrackSamples(graphStore, trackId, track.recordingId, 0);

      await sleep(1000);
    }

    await sleep(1000);
  }

  // Build Graph
  const outPath = path.join(__dirname, "../../graph-frontend/public/data/graph.json");

  fs.mkdirSync(path.dirname(outPath), { recursive: true });

  const graph = graphStore.getGraph();

  fs.writeFileSync(outPath, JSON.stringify(graph, null, 2));

  console.log("Graph written to public/data/graph.json");
  console.log(graph.nodes.length, graph.links.length);
}

buildGraph();