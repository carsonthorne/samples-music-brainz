async function getJson(path)
{
  const res = await fetch(path);

  if (!res.ok)
  {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed: ${res.status} (${path})`);
  }

  return res.json();
}

async function getJsonOrNull(path)
{
  try
  {
    return await getJson(path);
  }
  catch
  {
    return null;
  }
}

export function seedExpansionModeFor(node)
{
  if (node.type === "artist") return "artist_albums";
  if (node.type === "album") return "album_tracks";
  if (node.type === "track") return "track_samples";
  return null;
}

// The same entity type can expand differently depending on how the user reached it.
// Example: an album reached from an artist reveals tracks; an album reached from a
// sampled track reveals artists.
function withExpansionModes(fragment, mode)
{
  return {
    ...fragment,
    nodeModes: Object.fromEntries(
      (fragment.nodes || []).map((node) => [node.id, mode])
    )
  };
}

export async function searchGraphSeeds(query)
{
  const params = new URLSearchParams({
    q: query,
    limit: "30",
    perTypeLimit: "10"
  });

  const data = await getJson(`/api/search?${params}`);

  return {
    ...data,
    results: data.results.map((node) => ({
      ...node,
      nextExpansion: seedExpansionModeFor(node)
    }))
  };
}

export async function loadNodeNeighbors(nodeId, mode)
{
  if (mode === "artist_albums")
  {
    const fragment =
      await getJson(`/api/artists/${encodeURIComponent(nodeId)}/albums?limit=1000`);

    return withExpansionModes(fragment, "album_tracks");
  }

  if (mode === "album_tracks")
  {
    const fragment =
      await getJson(`/api/albums/${encodeURIComponent(nodeId)}/tracks?limit=2000`);

    return withExpansionModes(fragment, "track_samples");
  }

  if (mode === "track_samples")
  {
    const fragment =
      await getJson(`/api/tracks/${encodeURIComponent(nodeId)}/samples?limit=1000`);

    return withExpansionModes(fragment, "track_albums");
  }

  if (mode === "track_sampled_by")
  {
    const fragment =
      await getJson(`/api/tracks/${encodeURIComponent(nodeId)}/sampled-by?limit=1000`);

    return withExpansionModes(fragment, "track_albums");
  }

  if (mode === "track_albums")
  {
    const fragment =
      await getJson(`/api/tracks/${encodeURIComponent(nodeId)}/albums?limit=500`);

    return withExpansionModes(fragment, "album_artists");
  }

  if (mode === "album_artists")
  {
    const fragment =
      await getJson(`/api/albums/${encodeURIComponent(nodeId)}/artists?limit=500`);

    return withExpansionModes(fragment, "artist_albums");
  }

  return {
    parent: null,
    nodes: [],
    links: []
  };
}

export async function loadNodeDetails(nodeId)
{
  const node =
    typeof nodeId === "object" ? nodeId : { id: nodeId };

  const [type, rawId] =
    String(node.id).split(":");

  const lookupId =
    node.dbId || rawId || node.id;

  const details =
    await getJsonOrNull(`/api/nodes/${encodeURIComponent(type)}/${encodeURIComponent(lookupId)}/details`);

  if (details)
  {
    return details;
  }

  return loadFallbackDetails(node);
}

async function loadFallbackDetails(node)
{
  if (node.type === "artist")
  {
    const fragment =
      await getJson(`/api/artists/${encodeURIComponent(node.id)}/albums?limit=100`);

    return {
      node: fragment.parent || node,
      image: node.avatar || null,
      listLabel: "Albums",
      items: (fragment.nodes || []).map((item) => ({
        ...item,
        nextExpansion: "album_tracks"
      }))
    };
  }

  if (node.type === "album")
  {
    const fragment =
      await getJson(`/api/albums/${encodeURIComponent(node.id)}/tracks?limit=300`);

    return {
      node: fragment.parent || node,
      image: node.artwork || null,
      listLabel: "Tracks",
      items: (fragment.nodes || []).map((item) => ({
        ...item,
        nextExpansion: "track_samples"
      }))
    };
  }

  if (node.type === "track")
  {
    const fragment =
      await getJson(`/api/tracks/${encodeURIComponent(node.id)}/samples?limit=100`);

    return {
      node: fragment.parent || node,
      image: null,
      listLabel: "Samples",
      items: (fragment.nodes || []).map((item) => ({
        ...item,
        nextExpansion: "track_albums"
      }))
    };
  }

  return {
    node,
    image: null,
    listLabel: "Connections",
    items: []
  };
}
