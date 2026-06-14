  const fs = require("fs");
  const path = require("path");

const searchArtist = require("../api/musicbrainz/searchArtist");
const getAlbums = require("../api/musicbrainz/getAlbums");
const getReleaseFromGroup = require("../api/musicbrainz/getReleaseFromGroup");
const getTracksFromRelease = require("../api/musicbrainz/getTracksFromRelease");
const getSamplesFromRecording = require("../api/musicbrainz/getSamplesFromRecording");

const GraphStore = require("./graphStore");

const LIMITS = {
  albumsPerArtist: 5,
  tracksPerAlbum: 15,
  sampleDepth: 1
};


async function addTrackSamples(
  graphStore,
  trackId,
  recordingId,
  depth
) {
  if (depth >= LIMITS.sampleDepth) {
    return;
  }

  const samples = await getSamplesFromRecording(recordingId);

  for (const sample of samples) {
    const sampleId = `recording:${sample.id}`;

    graphStore.addNode({id: sampleId, type: "recording", name: sample.title, mbid: sample.id});

    graphStore.addLink(trackId, sampleId, "USES_SAMPLE");

    await addTrackSamples(graphStore, sampleId, sample.id, depth + 1);
  }
}

function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
}

async function buildGraph() {

  const graphStore = new GraphStore();

  // Store artist
  const artist = await searchArtist("a tribe called quest");
  const artistId = `artist:${artist.id}`;
  
  graphStore.addNode({
    id: artistId,
    type: "artist",
    name: artist.name,
    mbid: artist.id
  });

  // Store albums
  const albums = await getAlbums(artist.id);

  for (const album of albums.slice(0, LIMITS.albumsPerArtist)) {
    const albumId = `album:${album.id}`;

    graphStore.addNode({
      id: albumId,
      type: "album",
      name: album.title,
      mbid: album.id,
    });

    graphStore.addLink(artistId, albumId, "HAS_ALBUM");

    const release = await getReleaseFromGroup(album.id);
    if (!release) continue;


    // Store Tracks
    const tracks = await getTracksFromRelease(release.id);

    for (const track of tracks) {
      const trackId = `track:${track.recordingId}`;

      graphStore.addNode({
        id: trackId,
        type: "track",
        name: track.title,
        mbid: track.recordingId
      });

      graphStore.addLink(
        albumId,
        trackId,
        "HAS_TRACK"
      );

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