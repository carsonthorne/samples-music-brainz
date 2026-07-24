const express = require("express");
const cors = require("cors");
const path = require("path");
const { db, DB_PATH } = require("./db");
const { AVATAR_DIR, ARTWORK_DIR, existingAsset } = require("../assets/assetPaths");
const { ensureNodeImage } = require("../assets/ensureNodeImage");

const app = express();
const PORT = Number(process.env.PORT || 3001);
const HOST = process.env.HOST || "127.0.0.1";
const CLIENT_DIST_DIR = path.resolve(__dirname, "../../client/dist");

app.use(cors());
app.use(express.json());
app.use("/artwork", express.static(ARTWORK_DIR));
app.use("/avatars", express.static(AVATAR_DIR));

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

function normalizeFuzzySearchText(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/gi, " ")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

function fuzzySearchTokens(value) {
  return normalizeFuzzySearchText(value)
    .split(" ")
    .filter(Boolean)
    .slice(0, 5);
}

function fuzzyTokenVariants(token) {
  const variants = new Set([token]);

  if (token === "tha") variants.add("the");
  if (token === "the") variants.add("tha");

  if (token.length >= 3 && token.length <= 5) {
    if (token.endsWith("a")) variants.add(`${token.slice(0, -1)}e`);
    if (token.endsWith("e")) variants.add(`${token.slice(0, -1)}a`);
  }

  return [...variants];
}

function escapeLikePattern(value) {
  return String(value).replace(/[\\%_]/g, (char) => `\\${char}`);
}

function fuzzySequencePattern(value) {
  return `%${String(value).split("").map(escapeLikePattern).join("%")}%`;
}

function fuzzyPhrasePrefixPattern(tokens) {
  return `${tokens.map(escapeLikePattern).join("%")}%`;
}

function levenshteinDistance(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  const current = new Array(b.length + 1);

  for (let i = 1; i <= a.length; i += 1) {
    current[0] = i;

    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      current[j] = Math.min(
        current[j - 1] + 1,
        previous[j] + 1,
        previous[j - 1] + cost,
      );
    }

    for (let j = 0; j <= b.length; j += 1) {
      previous[j] = current[j];
    }
  }

  return previous[b.length];
}

function fuzzyTokenIndex(token, normalizedValue) {
  const variants = fuzzyTokenVariants(token);

  for (const variant of variants) {
    const index = normalizedValue.indexOf(variant);
    if (index !== -1) return index;
  }

  const words = normalizedValue.split(" ").filter(Boolean);
  for (let index = 0; index < words.length; index += 1) {
    const word = words[index];
    if (
      token.length >= 4 &&
      Math.abs(word.length - token.length) <= 1 &&
      levenshteinDistance(token, word) <= 1
    ) {
      return normalizedValue.indexOf(word);
    }
  }

  return -1;
}

function fuzzySearchScore(query, value) {
  const normalizedQuery = normalizeFuzzySearchText(query);
  const normalizedValue = normalizeFuzzySearchText(value);
  const compactQuery = normalizedQuery.replace(/\s+/g, "");
  const compactValue = normalizedValue.replace(/\s+/g, "");
  const hasTokenBreak = normalizedQuery.includes(" ");

  if (!normalizedQuery || !normalizedValue) return Number.MAX_SAFE_INTEGER;
  if (normalizedValue === normalizedQuery) return 0;
  if (compactQuery && compactValue === compactQuery) {
    return hasTokenBreak ? 30 + compactValue.length : 1;
  }
  if (normalizedValue.startsWith(normalizedQuery)) return 10 + normalizedValue.length;
  if (compactQuery && compactValue.startsWith(compactQuery)) {
    return hasTokenBreak ? 150 + compactValue.length : 20 + compactValue.length;
  }

  const phraseIndex = normalizedValue.indexOf(normalizedQuery);
  if (phraseIndex !== -1) return 100 + phraseIndex + normalizedValue.length;

  const compactIndex = compactQuery ? compactValue.indexOf(compactQuery) : -1;
  if (compactIndex !== -1) return 200 + compactIndex + compactValue.length;

  const tokens = normalizedQuery.split(" ").filter(Boolean);
  let tokenPenalty = 0;
  for (const token of tokens) {
    const tokenIndex = fuzzyTokenIndex(token, normalizedValue);
    if (tokenIndex === -1) return Number.MAX_SAFE_INTEGER;
    tokenPenalty += tokenIndex;
  }

  return 300 + tokenPenalty + normalizedValue.length;
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

function nodeSortText(node) {
  return String(node.name || node.title || node.label || "").toLocaleLowerCase();
}

function nodeSearchScore(query, node) {
  return fuzzySearchScore(query, node.name || node.title || node.label || "");
}

function nodeSearchWeight(node) {
  if (Number.isFinite(node.searchWeight)) return node.searchWeight;

  if (node.type === "artist") {
    return getArtistSearchWeight.get(node.dbId)?.weight || 0;
  }

  if (node.type === "album") {
    return getAlbumSearchWeight.get(node.dbId)?.weight || 0;
  }

  if (node.type === "track") {
    return getTrackSearchWeight.get(node.dbId, node.dbId)?.weight || 0;
  }

  return 0;
}

function sortSearchResults(query, results) {
  return results.sort((a, b) =>
    nodeSearchScore(query, a) - nodeSearchScore(query, b) ||
    nodeSearchWeight(b) - nodeSearchWeight(a) ||
    nodeSortText(a).localeCompare(
      nodeSortText(b),
      undefined,
      { sensitivity: "base" }
    )
  );
}

function titleFamilyKey(node) {
  return normalizeFuzzySearchText(node.name || node.title || node.label || "")
    .replace(/\b(instrumental|remaster(?:ed)?|radio edit|explicit|clean|version|verses)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function uniqueTitleFamilies(results) {
  const seenTitles = new Set();
  const unique = [];

  for (const node of results) {
    const key = titleFamilyKey(node);
    if (seenTitles.has(key)) continue;
    seenTitles.add(key);
    unique.push(node);
  }

  return unique;
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

const getArtistSearchWeight = db.prepare(`
  SELECT COUNT(*) AS weight
  FROM artist_albums
  WHERE artist_id = ?
`);

const getAlbumSearchWeight = db.prepare(`
  SELECT COUNT(*) AS weight
  FROM album_tracks
  WHERE album_id = ?
`);

const getTrackSearchWeight = db.prepare(`
  SELECT COUNT(*) AS weight
  FROM track_samples
  WHERE track_id = ? OR sampled_track_id = ?
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

function fuzzyTokenSearch(table, columns, searchColumn, tokens, limit) {
  if (!tokens.length) return [];

  const params = [];
  let where = tokens
    .map((token) => {
      const variants = fuzzyTokenVariants(token);
      params.push(...variants.map((variant) => `%${escapeLikePattern(variant)}%`));
      return `(${variants.map(() => `${searchColumn} LIKE ? ESCAPE '\\' COLLATE NOCASE`).join(" OR ")})`;
    })
    .join(" AND ");

  if (tokens.length === 1 && tokens[0].length >= 4) {
    where = `(${where} OR (${searchColumn} LIKE ? ESCAPE '\\' COLLATE NOCASE AND ${searchColumn} LIKE ? ESCAPE '\\' COLLATE NOCASE))`;
    params.push(`${escapeLikePattern(tokens[0].slice(0, 2))}%`);
    params.push(fuzzySequencePattern(tokens[0]));
  }

  const phrasePrefixPattern = fuzzyPhrasePrefixPattern(tokens);
  const sql = `
    SELECT ${columns.join(", ")}
    FROM ${table}
    WHERE ${where}
    ORDER BY
      CASE
        WHEN ${searchColumn} LIKE ? ESCAPE '\\' COLLATE NOCASE THEN 0
        ELSE 1
      END,
      ${searchColumn} COLLATE NOCASE
    LIMIT ?
  `;

  return db.prepare(sql).all(...params, phrasePrefixPattern, limit);
}

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

function searchGraphSeeds(q, options = {}) {
  const queryVariants = searchTextVariants(q);
  const fuzzyTokens = fuzzySearchTokens(q);
  const limit = options.limit || 25;
  const perTypeLimit = options.perTypeLimit || Math.ceil(limit / 3);
  const type = ["artist", "album", "track"].includes(options.type) ? options.type : null;
  const isPredictive = Boolean(options.predictive);

  if (
    isPredictive &&
    type === "track" &&
    q.length < 5
  ) {
    return {
      query: q,
      results: [],
    };
  }

  const seen = new Set();
  const results = [];

  function add(rows, mapper) {
    for (const row of rows) {
      const node = mapper(row);
      if (seen.has(node.id)) continue;
      node.searchWeight = nodeSearchWeight(node);
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

  function addFuzzy(rows, mapper, labelSelector) {
    const rankedRows = rows
      .map((row) => ({
        row,
        score: fuzzySearchScore(q, labelSelector(row)),
      }))
      .filter((entry) => entry.score !== Number.MAX_SAFE_INTEGER)
      .sort((a, b) => a.score - b.score || labelSelector(a.row).localeCompare(labelSelector(b.row)));

    add(rankedRows.map((entry) => entry.row), mapper);
  }

  function trackPrefixCandidates() {
    const candidates = [...results];
    const seenCandidates = new Set(candidates.map((node) => node.id));
    const candidateLimit = Math.max(limit * 12, 80);

    for (const variant of queryVariants) {
      for (const row of searchTracksPrefix.all(`${variant}%`, candidateLimit)) {
        const node = searchTrackNode(row);
        if (seenCandidates.has(node.id)) continue;
        node.searchWeight = nodeSearchWeight(node);
        seenCandidates.add(node.id);
        candidates.push(node);
      }
    }

    return candidates;
  }

  if (!type || type === "artist") addVariants(searchArtistsExact, artistNode);
  if (!type || type === "album") addVariants(searchAlbumsExact, searchAlbumNode);
  if (!type || type === "track") addVariants(searchTracksExact, searchTrackNode);

  if (type === "track") {
    return {
      query: q,
      results: uniqueTitleFamilies(sortSearchResults(q, trackPrefixCandidates()))
        .slice(0, limit),
    };
  }

  if (results.length < limit && (!type || type === "artist")) {
    addFuzzy(
      fuzzyTokenSearch(
        "artists",
        ["id", "mbid", "name", "sort_name", "disambiguation"],
        "name",
        fuzzyTokens,
        perTypeLimit * 4,
      ),
      artistNode,
      (row) => row.name,
    );
  }
  if (results.length < limit && (!type || type === "album")) {
    addFuzzy(
      fuzzyTokenSearch(
        "albums",
        ["id", "mbid", "title", "first_release_date", "type", "disambiguation"],
        "title",
        fuzzyTokens,
        perTypeLimit * 4,
      ),
      searchAlbumNode,
      (row) => row.title,
    );
  }
  if (results.length < limit && (!type || type === "artist")) addVariants(searchArtistsPrefix, artistNode, (value) => `${value}%`);
  if (results.length < limit && (!type || type === "album")) addVariants(searchAlbumsPrefix, searchAlbumNode, (value) => `${value}%`);
  if (results.length < limit && (!type || type === "track")) addVariants(searchTracksPrefix, searchTrackNode, (value) => `${value}%`);
  if (results.length < limit && (!type || type === "artist")) add(searchArtistsContains.all(`%${q}%`, perTypeLimit), artistNode);

  return {
    query: q,
    results: sortSearchResults(q, results).slice(0, limit),
  };
}

app.get("/api/search", (req, res) => {
  const q = String(req.query.q || "").trim();
  const limit = clampLimit(req.query.limit, 25, 100);
  const perTypeLimit = clampLimit(req.query.perTypeLimit, Math.ceil(limit / 3), 50);
  const type = String(req.query.type || "").trim();
  const predictive = ["1", "true", "yes"].includes(
    String(req.query.predictive || "").toLowerCase()
  );

  if (!q) {
    return res.status(400).json({ error: "Missing required query parameter: q" });
  }

  if (type && !["artist", "album", "track"].includes(type)) {
    return res.status(400).json({ error: `Unsupported search type: ${type}` });
  }

  res.json(searchGraphSeeds(q, { limit, perTypeLimit, type: type || null, predictive }));
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

app.use(express.static(CLIENT_DIST_DIR));

app.use((req, res, next) => {
  if (req.method !== "GET" || req.path.startsWith("/api/")) {
    return next();
  }

  res.sendFile(path.join(CLIENT_DIST_DIR, "index.html"), (err) => {
    if (err) next();
  });
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({
    error: err.message || "Internal server error",
  });
});

if (require.main === module) {
  const server = app.listen(PORT, HOST, () => {
    console.log(`Sample graph API listening on http://${HOST}:${PORT}`);
    console.log(`SQLite database: ${DB_PATH}`);
  });

  server.on("error", (err) => {
    console.error(`Could not start API server on ${HOST}:${PORT}`);
    console.error(err);
    process.exitCode = 1;
  });
}

module.exports = {
  app,
  searchGraphSeeds,
};
