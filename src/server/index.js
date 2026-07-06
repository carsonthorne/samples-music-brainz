const express = require("express");
const cors = require("cors");
const { db, DB_PATH } = require("./db");
const { existingAsset } = require("../assets/assetPaths");
const { ensureNodeImage } = require("../assets/ensureNodeImage");

const app = express();
const PORT = Number(process.env.PORT || 3001);
const HOST = process.env.HOST || "127.0.0.1";

app.use(cors());
app.use(express.json());

function clampLimit(value, fallback = 50, max = 500) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.min(Math.floor(n), max);
}

function readPositiveInteger(value, fallback, max = Infinity) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.min(Math.floor(n), max);
}

function normalizeSearchText(value) {
  return String(value || "")
    .replace(/[\u2010-\u2015\u2212]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

const DASH_SEARCH_CHARS = ["-", "\u2010", "\u2011", "\u2012", "\u2013", "\u2014", "\u2212"];

function searchTextVariants(value) {
  const normalized = normalizeSearchText(value);
  const variants = new Set([String(value || "").trim(), normalized]);

  if (normalized.includes("-")) {
    for (const dash of DASH_SEARCH_CHARS) {
      variants.add(normalized.replaceAll("-", dash));
    }
  }

  return [...variants].filter(Boolean);
}

function parseEntityId(value, expectedType) {
  const raw = decodeURIComponent(String(value || ""));
  const prefix = `${expectedType}:`;
  const numeric = raw.startsWith(prefix) ? raw.slice(prefix.length) : raw;
  const id = Number(numeric);

  if (!Number.isInteger(id) || id <= 0) {
    const err = new Error(`Invalid ${expectedType} id: ${value}`);
    err.status = 400;
    throw err;
  }

  return id;
}

function artistNode(row) {
  const node = {
    id: `artist:${row.id}`,
    dbId: row.id,
    type: "artist",
    label: row.name,
    mbid: row.mbid,
    name: row.name,
    sortName: row.sort_name,
    disambiguation: row.disambiguation,
  };

  const avatar = existingAsset("artist", row.mbid);
  if (avatar) node.avatar = avatar.webPath;

  return node;
}

function albumNode(row) {
  const node = {
    id: `album:${row.id}`,
    dbId: row.id,
    type: "album",
    label: row.title,
    mbid: row.mbid,
    name: row.title,
    title: row.title,
    firstReleaseDate: row.first_release_date,
    albumType: row.type,
    disambiguation: row.disambiguation,
  };

  const artwork = existingAsset("album", row.mbid);
  if (artwork) node.artwork = artwork.webPath;

  return node;
}

function trackNode(row) {
  return {
    id: `track:${row.id}`,
    dbId: row.id,
    type: "track",
    label: row.title,
    mbid: row.mbid,
    name: row.title,
    title: row.title,
    length: row.length,
    disambiguation: row.disambiguation,
  };
}

function link(source, target, type, extra = {}) {
  return {
    id: `${source}->${target}:${type}`,
    source,
    target,
    type,
    ...extra,
  };
}

function notFound(res, type, id) {
  return res.status(404).json({ error: `${type} not found`, id });
}

function asyncHandler(handler) {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

function modeForNodeType(type) {
  if (type === "artist") return "artist_albums";
  if (type === "album") return "album_tracks";
  if (type === "track") return "track_samples";
  return null;
}

function entityNode(type, id) {
  if (type === "artist") {
    const row = getArtist.get(id);
    return row ? artistNode(row) : null;
  }

  if (type === "album") {
    const row = getAlbum.get(id);
    return row ? albumNode(row) : null;
  }

  if (type === "track") {
    const row = getTrack.get(id);
    return row ? trackNode(row) : null;
  }

  return null;
}

function parseNodeRef(value) {
  const raw = decodeURIComponent(String(value || ""));
  const [type, idValue] = raw.split(":");

  if (!["artist", "album", "track"].includes(type)) {
    const err = new Error(`Unsupported node type: ${type || value}`);
    err.status = 400;
    throw err;
  }

  return {
    type,
    id: parseEntityId(idValue, type)
  };
}

const getArtist = db.prepare(`
  SELECT id, mbid, name, sort_name, disambiguation
  FROM artists
  WHERE id = ?
`);

const getAlbum = db.prepare(`
  SELECT id, mbid, title, first_release_date, type, disambiguation
  FROM albums
  WHERE id = ?
`);

const getTrack = db.prepare(`
  SELECT id, mbid, title, length, disambiguation
  FROM tracks
  WHERE id = ?
`);

const searchArtistsExact = db.prepare(`
  SELECT id, mbid, name, sort_name, disambiguation
  FROM artists
  WHERE name = ? COLLATE NOCASE
  ORDER BY name
  LIMIT ?
`);

const searchArtistsPrefix = db.prepare(`
  SELECT id, mbid, name, sort_name, disambiguation
  FROM artists
  WHERE name LIKE ? COLLATE NOCASE
  ORDER BY name
  LIMIT ?
`);

const searchArtistsContains = db.prepare(`
  SELECT id, mbid, name, sort_name, disambiguation
  FROM artists
  WHERE name LIKE ? COLLATE NOCASE
  ORDER BY name
  LIMIT ?
`);

const searchAlbumsExact = db.prepare(`
  SELECT id, mbid, title, first_release_date, type, disambiguation
  FROM albums
  WHERE title = ? COLLATE NOCASE
  ORDER BY title
  LIMIT ?
`);

const searchAlbumsPrefix = db.prepare(`
  SELECT id, mbid, title, first_release_date, type, disambiguation
  FROM albums
  WHERE title LIKE ? COLLATE NOCASE
  ORDER BY title
  LIMIT ?
`);

const searchTracksExact = db.prepare(`
  SELECT id, mbid, title, length, disambiguation
  FROM tracks
  WHERE title = ? COLLATE NOCASE
  ORDER BY title
  LIMIT ?
`);

const searchTracksPrefix = db.prepare(`
  SELECT id, mbid, title, length, disambiguation
  FROM tracks
  WHERE title LIKE ? COLLATE NOCASE
  ORDER BY title
  LIMIT ?
`);

const getArtistAlbums = db.prepare(`
  SELECT albums.id, albums.mbid, albums.title, albums.first_release_date, albums.type, albums.disambiguation
  FROM artist_albums
  JOIN albums ON albums.id = artist_albums.album_id
  WHERE artist_albums.artist_id = ?
  ORDER BY albums.title COLLATE NOCASE
  LIMIT ?
`);

const getAlbumTracks = db.prepare(`
  SELECT
    tracks.id,
    tracks.mbid,
    tracks.title,
    tracks.length,
    tracks.disambiguation,
    album_tracks.position,
    album_tracks.track_number,
    album_tracks.title_on_release
  FROM album_tracks
  JOIN tracks ON tracks.id = album_tracks.track_id
  WHERE album_tracks.album_id = ?
  ORDER BY album_tracks.position, album_tracks.track_number COLLATE NOCASE, tracks.title COLLATE NOCASE
  LIMIT ?
`);

const getTrackSamples = db.prepare(`
  SELECT
    sampled.id,
    sampled.mbid,
    sampled.title,
    sampled.length,
    sampled.disambiguation,
    track_samples.relationship_type
  FROM track_samples
  JOIN tracks AS sampled ON sampled.id = track_samples.sampled_track_id
  WHERE track_samples.track_id = ?
  ORDER BY sampled.title COLLATE NOCASE
  LIMIT ?
`);

const getTrackSampledBy = db.prepare(`
  SELECT
    source.id,
    source.mbid,
    source.title,
    source.length,
    source.disambiguation,
    track_samples.relationship_type
  FROM track_samples
  JOIN tracks AS source ON source.id = track_samples.track_id
  WHERE track_samples.sampled_track_id = ?
  ORDER BY source.title COLLATE NOCASE
  LIMIT ?
`);

const getTrackAlbums = db.prepare(`
  SELECT DISTINCT
    albums.id,
    albums.mbid,
    albums.title,
    albums.first_release_date,
    albums.type,
    albums.disambiguation
  FROM album_tracks
  JOIN albums ON albums.id = album_tracks.album_id
  WHERE album_tracks.track_id = ?
  ORDER BY albums.first_release_date, albums.title COLLATE NOCASE
  LIMIT ?
`);

const getAlbumArtists = db.prepare(`
  SELECT artists.id, artists.mbid, artists.name, artists.sort_name, artists.disambiguation
  FROM artist_albums
  JOIN artists ON artists.id = artist_albums.artist_id
  WHERE artist_albums.album_id = ?
  ORDER BY artists.name COLLATE NOCASE
  LIMIT ?
`);

const getAlbumArtistNames = db.prepare(`
  SELECT GROUP_CONCAT(name, ', ') AS names
  FROM (
    SELECT DISTINCT artists.name
    FROM artist_albums
    JOIN artists ON artists.id = artist_albums.artist_id
    WHERE artist_albums.album_id = ?
    ORDER BY artists.name COLLATE NOCASE
    LIMIT 4
  )
`);

const getTrackArtistNames = db.prepare(`
  SELECT GROUP_CONCAT(name, ', ') AS names
  FROM (
    SELECT DISTINCT artists.name
    FROM album_tracks
    JOIN artist_albums ON artist_albums.album_id = album_tracks.album_id
    JOIN artists ON artists.id = artist_albums.artist_id
    WHERE album_tracks.track_id = ?
    ORDER BY artists.name COLLATE NOCASE
    LIMIT 4
  )
`);

const getTrackPanelAlbum = db.prepare(`
  SELECT DISTINCT
    albums.id,
    albums.mbid,
    albums.title,
    albums.first_release_date,
    albums.type,
    albums.disambiguation
  FROM album_tracks
  JOIN albums ON albums.id = album_tracks.album_id
  WHERE album_tracks.track_id = ?
  ORDER BY albums.first_release_date, albums.title COLLATE NOCASE
  LIMIT 1
`);

async function imageForNode(node, trackAlbum = null) {
  if (node.type === "artist") {
    const image = await ensureNodeImage("artist", node.mbid);
    return image?.webPath || null;
  }

  if (node.type === "album") {
    const image = await ensureNodeImage("album", node.mbid);
    return image?.webPath || null;
  }

  if (node.type === "track" && trackAlbum) {
    const image = await ensureNodeImage("album", trackAlbum.mbid);
    return image?.webPath || null;
  }

  return null;
}

function searchAlbumNode(row) {
  const node = albumNode(row);
  const artistName = getAlbumArtistNames.get(row.id)?.names || "";

  if (artistName) {
    node.artistName = artistName;
    node.artistNames = artistName;
  }

  return node;
}

function searchTrackNode(row) {
  const node = trackNode(row);
  const artistName = getTrackArtistNames.get(row.id)?.names || "";

  if (artistName) {
    node.artistName = artistName;
    node.artistNames = artistName;
  }

  return node;
}

function expansionForNode(node, mode, perNodeLimit) {
  if (mode === "artist_albums") {
    const rows = getArtistAlbums.all(node.dbId, perNodeLimit);

    return {
      nodes: rows.map(albumNode),
      links: rows.map((row) => link(node.id, `album:${row.id}`, "artist_album")),
      childMode: "album_tracks"
    };
  }

  if (mode === "album_tracks") {
    const rows = getAlbumTracks.all(node.dbId, perNodeLimit);

    return {
      nodes: rows.map(trackNode),
      links: rows.map((row) => link(node.id, `track:${row.id}`, "album_track", {
        position: row.position,
        trackNumber: row.track_number,
        titleOnRelease: row.title_on_release,
      })),
      childMode: "track_samples"
    };
  }

  if (mode === "track_samples") {
    const rows = getTrackSamples.all(node.dbId, perNodeLimit);

    return {
      nodes: rows.map(trackNode),
      links: rows.map((row) => link(node.id, `track:${row.id}`, "samples", {
        relationshipType: row.relationship_type,
      })),
      childMode: "track_albums"
    };
  }

  if (mode === "track_albums") {
    const rows = getTrackAlbums.all(node.dbId, perNodeLimit);

    return {
      nodes: rows.map(albumNode),
      links: rows.map((row) => link(node.id, `album:${row.id}`, "track_album")),
      childMode: "album_artists"
    };
  }

  if (mode === "album_artists") {
    const rows = getAlbumArtists.all(node.dbId, perNodeLimit);

    return {
      nodes: rows.map(artistNode),
      links: rows.map((row) => link(node.id, `artist:${row.id}`, "album_artist")),
      childMode: "artist_albums"
    };
  }

  return {
    nodes: [],
    links: [],
    childMode: null
  };
}

function buildExpandedSubgraph(rootNode, options = {}) {
  const nodeLimit = options.nodeLimit;
  const depthLimit = options.depthLimit;
  const perNodeLimit = options.perNodeLimit;
  const nodesById = new Map([[rootNode.id, rootNode]]);
  const nodeModes = { [rootNode.id]: modeForNodeType(rootNode.type) };
  const linksById = new Map();
  const expanded = new Set();
  const visited = new Set();
  const queue = [{
    node: rootNode,
    mode: nodeModes[rootNode.id],
    depth: 0
  }];
  let truncated = false;

  while (queue.length) {
    const current = queue.shift();
    if (!current.node?.id || visited.has(current.node.id)) continue;
    visited.add(current.node.id);

    if (!current.mode || current.depth >= depthLimit) continue;

    const expansion = expansionForNode(current.node, current.mode, perNodeLimit);
    expanded.add(current.node.id);

    for (const edge of expansion.links) {
      linksById.set(edge.id, edge);
    }

    for (const child of expansion.nodes) {
      const isNew = !nodesById.has(child.id);

      if (isNew && nodesById.size >= nodeLimit) {
        truncated = true;
        break;
      }

      if (isNew) {
        nodesById.set(child.id, child);
      }

      if (expansion.childMode && !nodeModes[child.id]) {
        nodeModes[child.id] = expansion.childMode;
      }

      if (current.depth + 1 < depthLimit) {
        queue.push({
          node: nodesById.get(child.id),
          mode: nodeModes[child.id] || expansion.childMode,
          depth: current.depth + 1
        });
      }
    }

    if (truncated) break;
  }

  return {
    parent: rootNode,
    nodes: [...nodesById.values()].filter((node) => node.id !== rootNode.id),
    links: [...linksById.values()].filter((edge) =>
      nodesById.has(edge.source) && nodesById.has(edge.target)
    ),
    nodeModes,
    expanded: [...expanded],
    stats: {
      nodes: nodesById.size,
      links: linksById.size,
      expanded: expanded.size,
      depthLimit,
      nodeLimit,
      perNodeLimit,
      truncated
    }
  };
}

app.get("/api/health", (req, res) => {
  const counts = {
    artists: db.prepare("SELECT COUNT(*) AS count FROM artists").get().count,
    albums: db.prepare("SELECT COUNT(*) AS count FROM albums").get().count,
    tracks: db.prepare("SELECT COUNT(*) AS count FROM tracks").get().count,
    artistAlbums: db.prepare("SELECT COUNT(*) AS count FROM artist_albums").get().count,
    albumTracks: db.prepare("SELECT COUNT(*) AS count FROM album_tracks").get().count,
    trackSamples: db.prepare("SELECT COUNT(*) AS count FROM track_samples").get().count,
  };

  res.json({ ok: true, dbPath: DB_PATH, counts });
});

app.get("/api/search", (req, res) => {
  const q = String(req.query.q || "").trim();
  const queryVariants = searchTextVariants(q);
  const limit = clampLimit(req.query.limit, 25, 100);
  const perTypeLimit = clampLimit(req.query.perTypeLimit, Math.ceil(limit / 3), 50);

  if (!q) {
    return res.status(400).json({ error: "Missing required query parameter: q" });
  }

  const seen = new Set();
  const results = [];

  function add(rows, mapper) {
    for (const row of rows) {
      const node = mapper(row);
      if (seen.has(node.id)) continue;
      seen.add(node.id);
      results.push(node);
      if (results.length >= limit) break;
    }
  }

  function addVariants(statement, mapper, pattern = (value) => value) {
    for (const variant of queryVariants) {
      if (results.length >= limit) break;
      add(statement.all(pattern(variant), perTypeLimit), mapper);
    }
  }

  addVariants(searchArtistsExact, artistNode);
  addVariants(searchAlbumsExact, searchAlbumNode);
  addVariants(searchTracksExact, searchTrackNode);

  if (results.length < limit) addVariants(searchArtistsPrefix, artistNode, (value) => `${value}%`);
  if (results.length < limit) addVariants(searchAlbumsPrefix, searchAlbumNode, (value) => `${value}%`);
  if (results.length < limit) addVariants(searchTracksPrefix, searchTrackNode, (value) => `${value}%`);
  if (results.length < limit) add(searchArtistsContains.all(`%${q}%`, perTypeLimit), artistNode);

  res.json({
    query: q,
    results: results.slice(0, limit),
  });
});

app.get("/api/subgraph", (req, res) => {
  const root = parseNodeRef(req.query.root);
  const nodeLimit = readPositiveInteger(req.query.limit, 1500, 50000);
  const depthLimit = readPositiveInteger(req.query.depth, 6, 100);
  const perNodeLimit = clampLimit(req.query.perNodeLimit, 150, 500);
  const rootNode = entityNode(root.type, root.id);

  if (!rootNode) return notFound(res, root.type, root.id);

  res.json(buildExpandedSubgraph(rootNode, {
    nodeLimit,
    depthLimit,
    perNodeLimit
  }));
});

app.get("/api/artists/:id", (req, res) => {
  const id = parseEntityId(req.params.id, "artist");
  const row = getArtist.get(id);
  if (!row) return notFound(res, "artist", id);
  res.json({ node: artistNode(row) });
});

app.get("/api/artists/:id/albums", (req, res) => {
  const id = parseEntityId(req.params.id, "artist");
  const limit = clampLimit(req.query.limit, 100, 1000);
  const artist = getArtist.get(id);
  if (!artist) return notFound(res, "artist", id);

  const parent = artistNode(artist);
  const albums = getArtistAlbums.all(id, limit);
  const nodes = albums.map(albumNode);
  const links = nodes.map((album) => link(parent.id, album.id, "artist_album"));

  res.json({ parent, nodes, links });
});

app.get("/api/albums/:id", (req, res) => {
  const id = parseEntityId(req.params.id, "album");
  const row = getAlbum.get(id);
  if (!row) return notFound(res, "album", id);
  res.json({ node: albumNode(row) });
});

app.get("/api/albums/:id/tracks", (req, res) => {
  const id = parseEntityId(req.params.id, "album");
  const limit = clampLimit(req.query.limit, 300, 2000);
  const album = getAlbum.get(id);
  if (!album) return notFound(res, "album", id);

  const parent = albumNode(album);
  const rows = getAlbumTracks.all(id, limit);
  const nodes = rows.map(trackNode);
  const links = rows.map((row) => link(parent.id, `track:${row.id}`, "album_track", {
    position: row.position,
    trackNumber: row.track_number,
    titleOnRelease: row.title_on_release,
  }));

  res.json({ parent, nodes, links });
});

app.get("/api/albums/:id/artists", (req, res) => {
  const id = parseEntityId(req.params.id, "album");
  const limit = clampLimit(req.query.limit, 50, 500);
  const album = getAlbum.get(id);
  if (!album) return notFound(res, "album", id);

  const parent = albumNode(album);
  const artists = getAlbumArtists.all(id, limit);
  const nodes = artists.map(artistNode);
  const links = nodes.map((artist) => link(parent.id, artist.id, "album_artist"));

  res.json({ parent, nodes, links });
});

app.get("/api/tracks/:id", (req, res) => {
  const id = parseEntityId(req.params.id, "track");
  const row = getTrack.get(id);
  if (!row) return notFound(res, "track", id);
  res.json({ node: trackNode(row) });
});

app.get("/api/tracks/:id/samples", (req, res) => {
  const id = parseEntityId(req.params.id, "track");
  const limit = clampLimit(req.query.limit, 100, 1000);
  const track = getTrack.get(id);
  if (!track) return notFound(res, "track", id);

  const parent = trackNode(track);
  const rows = getTrackSamples.all(id, limit);
  const nodes = rows.map(trackNode);
  const links = rows.map((row) => link(parent.id, `track:${row.id}`, "samples", {
    relationshipType: row.relationship_type,
  }));

  res.json({ parent, nodes, links });
});

app.get("/api/tracks/:id/sampled-by", (req, res) => {
  const id = parseEntityId(req.params.id, "track");
  const limit = clampLimit(req.query.limit, 100, 1000);
  const sampled = getTrack.get(id);
  if (!sampled) return notFound(res, "track", id);

  const parent = trackNode(sampled);
  const rows = getTrackSampledBy.all(id, limit);
  const nodes = rows.map(trackNode);
  const links = rows.map((row) => link(`track:${row.id}`, parent.id, "samples", {
    relationshipType: row.relationship_type,
  }));

  res.json({ parent, nodes, links });
});

app.get("/api/tracks/:id/albums", (req, res) => {
  const id = parseEntityId(req.params.id, "track");
  const limit = clampLimit(req.query.limit, 50, 500);
  const track = getTrack.get(id);
  if (!track) return notFound(res, "track", id);

  const parent = trackNode(track);
  const albums = getTrackAlbums.all(id, limit);
  const nodes = albums.map(albumNode);
  const links = nodes.map((album) => link(parent.id, album.id, "track_album"));

  res.json({ parent, nodes, links });
});

app.get("/api/nodes/:type/:id/details", asyncHandler(async (req, res) => {
  const type = String(req.params.type || "");
  const id = parseEntityId(req.params.id, type);

  if (type === "artist") {
    const row = getArtist.get(id);
    if (!row) return notFound(res, "artist", id);

    const node = artistNode(row);
    const rows = getArtistAlbums.all(id, clampLimit(req.query.limit, 100, 500));
    const items = rows.map((album) => ({
      ...albumNode(album),
      nextExpansion: "album_tracks"
    }));

    return res.json({
      node,
      image: await imageForNode(node),
      listLabel: "Albums",
      items
    });
  }

  if (type === "album") {
    const row = getAlbum.get(id);
    if (!row) return notFound(res, "album", id);

    const node = albumNode(row);
    const artists = getAlbumArtists.all(id, 20).map((artist) => ({
      ...artistNode(artist),
      nextExpansion: "artist_albums"
    }));
    const rows = getAlbumTracks.all(id, clampLimit(req.query.limit, 300, 1000));
    const items = rows.map((track) => ({
      ...trackNode(track),
      nextExpansion: "track_samples",
      position: track.position,
      trackNumber: track.track_number,
      titleOnRelease: track.title_on_release
    }));

    return res.json({
      node,
      artists,
      image: await imageForNode(node),
      listLabel: "Tracks",
      items,
      sections: [
        {
          label: "Tracks",
          items
        }
      ]
    });
  }

  if (type === "track") {
    const row = getTrack.get(id);
    if (!row) return notFound(res, "track", id);

    const node = trackNode(row);
    const albumRow = getTrackPanelAlbum.get(id);
    const album = albumRow ? albumNode(albumRow) : null;
    const artists = album
      ? getAlbumArtists.all(album.dbId, 20).map((artist) => ({
          ...artistNode(artist),
          nextExpansion: "artist_albums"
        }))
      : [];
    const limit = clampLimit(req.query.limit, 100, 500);
    const sampleRows = getTrackSamples.all(id, limit);
    const sampledByRows = getTrackSampledBy.all(id, limit);
    const samples = sampleRows.map((track) => ({
      ...searchTrackNode(track),
      nextExpansion: "track_albums",
      parentExpansionMode: "track_samples",
      relationshipType: track.relationship_type
    }));
    const sampledBy = sampledByRows.map((track) => ({
      ...searchTrackNode(track),
      nextExpansion: "track_albums",
      parentExpansionMode: "track_sampled_by",
      relationshipType: track.relationship_type
    }));

    return res.json({
      node,
      album,
      artists,
      image: await imageForNode(node, album),
      listLabel: "Samples",
      items: samples,
      sections: [
        {
          label: "Samples",
          items: samples
        },
        {
          label: "Sampled By",
          items: sampledBy
        }
      ]
    });
  }

  res.status(400).json({ error: `Unsupported node type: ${type}` });
}));

app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({
    error: err.message || "Internal server error",
  });
});

const server = app.listen(PORT, HOST, () => {
  console.log(`Sample graph API listening on http://${HOST}:${PORT}`);
  console.log(`SQLite database: ${DB_PATH}`);
});

server.on("error", (err) => {
  console.error(`Could not start API server on ${HOST}:${PORT}`);
  console.error(err);
  process.exitCode = 1;
});
