const fs = require("fs");

const searchArtist = require("../api/musicbrainz/searchArtist");
const getAlbums = require("../api/musicbrainz/getAlbums");
const getReleaseFromGroup = require("../api/musicbrainz/getReleaseFromGroup");
const getTracksFromRelease = require("../api/musicbrainz/getTracksFromRelease");
const getSamplesFromRecording = require("../api/musicbrainz/getSamplesFromRecording");

const nodeIds = new Set();
const linkIds = new Set();

const LIMITS = {
  albumsPerArtist: 5,
  tracksPerAlbum: 15,
  sampleDepth: 1
};

function addNode(graph, node) {
  if (nodeIds.has(node.id)) {
    return;
  }

  nodeIds.add(node.id);
  graph.nodes.push(node);
}

function addLink(graph, source, target, type) {
  const key = `${source}|${target}|${type}`;

  if (linkIds.has(key)) {
    return;
  }

  linkIds.add(key)

  graph.links.push({source, target, type});
}

async function addTrackSamples(
  graph,
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

    addNode(graph, {id: sampleId, type: "recording", name: sample.title, mbid: sample.id});

    addLink(graph, trackId, sampleId, "USES_SAMPLE");

    await addTrackSamples(graph, sampleId, sample.id, depth + 1);
  }
}

function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
}

async function buildGraph() {
  const graph = {
    version: 1,
    generatedAt: new Date().toISOString(),
    rootArtist: "A Tribe Called Quest",
    nodes: [],
    links: []
  };

  const artist = await searchArtist("a tribe called quest");

  const artistId = `artist:${artist.id}`;

  addNode(graph, {
    id: artistId,
    type: "artist",
    name: artist.name,
    mbid: artist.id
  });

  const albums = await getAlbums(artist.id);

  for (const album of albums.slice(0, LIMITS.albumsPerArtist)) {
    const albumId = `album:${album.id}`;

    addNode(graph, {
      id: albumId,
      type: "album",
      name: album.title,
      mbid: album.id,
    });

    addLink(graph, artistId, albumId, "HAS_ALBUM");

    const release = await getReleaseFromGroup(album.id);
    if (!release) continue;

    const tracks = await getTracksFromRelease(release.id);

    for (const track of tracks) {
      const trackId = `track:${track.recordingId}`;

      addNode(graph, {
        id: trackId,
        type: "track",
        name: track.title,
        mbid: track.recordingId
      });

      addLink(
        graph,
        albumId,
        trackId,
        "HAS_TRACK"
      );

      await addTrackSamples(graph, trackId, track.recordingId, 0);

      await sleep(1000);
    }

    await sleep(1000);
  }

  const fs = require("fs");
  const path = require("path");

  const outPath = path.join(__dirname, "../../graph-frontend/public/data/graph.json");

  fs.mkdirSync(path.dirname(outPath), { recursive: true });

  fs.writeFileSync(outPath, JSON.stringify(graph, null, 2));

  console.log("Graph written to public/data/graph.json");
  console.log(graph.nodes.length, graph.links.length);
  console.log(new Set(graph.nodes.map(n => n.id)).size === graph.nodes.length);

  const linkedNodeIds = new Set();

  graph.links.forEach(link => {
    linkedNodeIds.add(link.source);
    linkedNodeIds.add(link.target);
  });

  const orphanNodes = graph.nodes.filter(
    node => !linkedNodeIds.has(node.id)
  );

  console.log(orphanNodes);
  console.log("orphans:", orphanNodes.length);

  console.log(JSON.stringify(orphanNodes, null, 2));
  console.log("unique ids", new Set(graph.nodes.map(n => n.id)).size);

  const trackAlbums = {};
  
  for (const link of graph.links) {
    if (link.type !== "HAS_TRACK") continue;
  
    if (!trackAlbums[link.target]) {
      trackAlbums[link.target] = [];
    }
  
    trackAlbums[link.target].push(link.source);
  }
  
  for (const [trackId, albums] of Object.entries(trackAlbums)) {
    if (albums.length > 1) {
      console.log(
        "Track appears on multiple albums:",
        trackId,
        albums
      );
    }
  }







}




buildGraph();