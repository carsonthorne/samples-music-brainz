export function createGraphEvents(
  state,
  getGraph,
  loadNeighbors,
  setStatus,
  onNodeSelected = () => {}
)
{
  let cameraFocusRun = 0;
  let statusClearTimer = null;
  const loadedConnectionModes = new Set();

  async function handleNodeClick(node, options = {})
  {
    if (!node?.id) return;

    getGraph()?.stopAutoOrbit?.();

    if (node.id !== state.focusNode && !options.forceExpand)
    {
      focusNode(node.id, options);
      return;
    }

    if (state.expanded.has(node.id) && !options.forceExpand)
    {
      state.expanded.delete(node.id);
    }
    else
    {
      const mode = state.getExpansionMode(node.id);

      if (mode && !hasLoadedMode(node.id, mode))
      {
        try
        {
          setStatus?.("Loading connections...");
          const fragment =
            await loadNeighbors(node.id, mode);

          state.mergeFragment(fragment);
          state.markNeighborsLoaded(node.id);
          markModeLoaded(node.id, mode);
          setStatus?.("");
        }
        catch (err)
        {
          setStatus?.(err.message);
          return;
        }
      }

      state.expanded.add(node.id);
    }

    focusNode(node.id, options);
  }

  async function selectAndExpandNode(node, options = {})
  {
    if (!node?.id) return;

    getGraph()?.stopAutoOrbit?.();

    if (!state.graph.nodesById[node.id])
    {
      state.addNode(node);
    }

    await handleNodeClick(
      state.graph.nodesById[node.id],
      options
    );
  }

  function graphNodePayload(node)
  {
    if (!node) return node;

    const {
      expansionPath,
      parentExpansionMode,
      parentNode,
      ...payload
    } = node;

    return payload;
  }

  async function focusRelatedNode(parentNode, node, options = {})
  {
    if (!node?.id) return;

    getGraph()?.stopAutoOrbit?.();

    if (!state.graph.nodesById[parentNode?.id])
    {
      state.addNode(graphNodePayload(parentNode));
    }

    const parent =
      state.graph.nodesById[parentNode?.id];

    const expansionPath =
      options.expansionPath || node.expansionPath || [];

    try
    {
      for (const step of expansionPath)
      {
        const stepNode =
          step.node || state.graph.nodesById[step.nodeId];
        const stepNodeId =
          step.nodeId || stepNode?.id;

        if (stepNode && !state.graph.nodesById[stepNode.id])
        {
          state.addNode(graphNodePayload(stepNode));
        }

        if (stepNodeId && step.mode)
        {
          setStatus?.("Loading connections...");
          await ensureModeExpanded(stepNodeId, step.mode);
        }
      }

      const mode =
        options.parentExpansionMode ||
        options.expansionMode ||
        node.parentExpansionMode ||
        (!expansionPath.length && parent ? state.getExpansionMode(parent.id) : null);

      if (parent && mode)
      {
        setStatus?.("Loading connections...");
        await ensureModeExpanded(parent.id, mode);
      }

      setStatus?.("");
    }
    catch (err)
    {
      setStatus?.(err.message);
      return;
    }

    if (!state.graph.nodesById[node.id])
    {
      state.addNode(graphNodePayload(node));
    }

    focusNode(node.id);
  }

  function focusNode(nodeId, options = {})
  {
    const node = state.graph.nodesById[nodeId];
    if (!node) return;

    getGraph()?.stopAutoOrbit?.();
    state.setFocus(nodeId);

    getGraph()?.graphData(
      state.toForceGraph()
    );

    scheduleCameraFocus(nodeId);

    onNodeSelected(node, options);
  }

  function setTemporaryStatus(message, delay = 8000)
  {
    if (statusClearTimer)
    {
      clearTimeout(statusClearTimer);
    }

    setStatus?.(message);
    statusClearTimer = setTimeout(() =>
    {
      setStatus?.("");
      statusClearTimer = null;
    }, delay);
  }

  function setCurrentStatus(message)
  {
    if (statusClearTimer)
    {
      clearTimeout(statusClearTimer);
      statusClearTimer = null;
    }

    setStatus?.(message);
  }

  function artistLabel(artists)
  {
    if (!artists.length)
    {
      return "the selected artist";
    }

    const names = artists.map((artist) => artist.name || artist.label || artist.id);

    if (names.length <= 2)
    {
      return names.join(" and ");
    }

    return `${names.slice(0, 2).join(", ")}, and ${names.length - 2} more`;
  }

  function scheduleCameraFocus(nodeId)
  {
    const runId = ++cameraFocusRun;
    const delays = [80, 220, 500, 900];

    for (const delay of delays)
    {
      setTimeout(() =>
      {
        if (runId !== cameraFocusRun) return;
        if (focusCameraOnNode(nodeId))
        {
          cameraFocusRun++;
        }
      }, delay);
    }
  }

  function focusCameraOnNode(nodeId)
  {
    const graph = getGraph();
    if (!graph) return false;

    const node = getCurrentGraphNode(nodeId) || state.graph.nodesById[nodeId];
    if (!node) return false;

    const x = Number(node.x);
    const y = Number(node.y);
    const z = Number(node.z ?? 0);

    if (!Number.isFinite(x) || !Number.isFinite(y))
      return false;

    if (!Number.isFinite(z))
      return false;

    graph.cameraPosition(
      {
        x,
        y,
        z: z + 200
      },
      node,
      1200
    );

    return true;
  }

  function getCurrentGraphNode(nodeId)
  {
    const graph = getGraph();
    if (!graph) return null;

    const data = graph.graphData();
    return data?.nodes?.find(node => node.id === nodeId) || null;
  }

  function modeKey(nodeId, mode)
  {
    return `${nodeId}|${mode}`;
  }

  function markModeLoaded(nodeId, mode)
  {
    if (!nodeId || !mode) return;
    loadedConnectionModes.add(modeKey(nodeId, mode));
  }

  function hasLoadedMode(nodeId, mode)
  {
    return loadedConnectionModes.has(modeKey(nodeId, mode));
  }

  function renderGraph()
  {
    getGraph()?.graphData(
      state.toForceGraph()
    );
  }

  function visibleChildren(parentId, type = null)
  {
    return (state.graph.adjacency[parentId] || [])
      .map((edge) => state.graph.nodesById[edge.target])
      .filter((node) => node && (!type || node.type === type));
  }

  function connectedNodes(nodeId, type = null, linkType = null)
  {
    const seen = new Set();
    const nodes = [];

    function addNode(id)
    {
      if (!id || seen.has(id)) return;

      const node = state.graph.nodesById[id];
      if (!node || (type && node.type !== type)) return;

      seen.add(id);
      nodes.push(node);
    }

    for (const edge of state.graph.adjacency[nodeId] || [])
    {
      if (!linkType || edge.type === linkType)
      {
        addNode(edge.target);
      }
    }

    for (const edge of state.graph.reverseAdjacency[nodeId] || [])
    {
      if (!linkType || edge.type === linkType)
      {
        addNode(edge.source);
      }
    }

    return nodes;
  }

  async function ensureModeExpanded(nodeId, mode)
  {
    if (!nodeId || !mode) return null;

    if (!hasLoadedMode(nodeId, mode))
    {
      const fragment = await loadNeighbors(nodeId, mode);
      state.mergeFragment(fragment);
      markModeLoaded(nodeId, mode);

      if (mode === state.getExpansionMode(nodeId))
      {
        state.markNeighborsLoaded(nodeId);
      }
    }

    state.expanded.add(nodeId);
    return state.graph.nodesById[nodeId] || null;
  }

  async function artistNodesForFocus(startNode)
  {
    if (!startNode) return [];

    if (startNode.type === "artist")
    {
      return [startNode];
    }

    if (startNode.type === "album")
    {
      await ensureModeExpanded(startNode.id, "album_artists");
      return visibleChildren(startNode.id, "artist");
    }

    if (startNode.type === "track")
    {
      await ensureModeExpanded(startNode.id, "track_albums");
      const albums = visibleChildren(startNode.id, "album");

      for (const album of albums)
      {
        await ensureModeExpanded(album.id, "album_artists");
      }

      return albums.flatMap((album) => visibleChildren(album.id, "artist"));
    }

    return [];
  }

  async function expandArtistConnectionPath(artist)
  {
    await ensureModeExpanded(artist.id, "artist_albums");
    const albums = visibleChildren(artist.id, "album");

    for (const album of albums)
    {
      await ensureModeExpanded(album.id, "album_tracks");
    }

    const tracks = albums.flatMap((album) => visibleChildren(album.id, "track"));

    for (const track of tracks)
    {
      await ensureModeExpanded(track.id, "track_samples");
      await ensureModeExpanded(track.id, "track_sampled_by");
    }

    const relatedTracks = tracks.flatMap((track) =>
      connectedNodes(track.id, "track", "samples")
    );

    for (const relatedTrack of relatedTracks)
    {
      await ensureModeExpanded(relatedTrack.id, "track_albums");
    }

    const relatedAlbums = relatedTracks.flatMap((track) =>
      visibleChildren(track.id, "album")
    );

    for (const relatedAlbum of relatedAlbums)
    {
      await ensureModeExpanded(relatedAlbum.id, "album_artists");
    }
  }

  async function showArtistConnections()
  {
    const startNode =
      state.graph.nodesById[state.focusNode] ||
      state.graph.nodesById[state.rootId];

    if (!startNode) return;

    getGraph()?.stopAutoOrbit?.();
    setCurrentStatus("Finding artist connections...");

    try
    {
      const artists = await artistNodesForFocus(startNode);
      const uniqueArtists =
        [...new Map(artists.map((artist) => [artist.id, artist])).values()];

      for (const artist of uniqueArtists)
      {
        await expandArtistConnectionPath(artist);
      }

      renderGraph();
      setTemporaryStatus(`Showed artist connections for ${artistLabel(uniqueArtists)}.`);
    }
    catch (err)
    {
      setStatus?.(err.message);
      return;
    }

    setTimeout(() =>
    {
      getGraph()?.fitToCanvas?.(1200);
    }, 250);

    setTimeout(() =>
    {
      getGraph()?.startAutoOrbit?.();
    }, 1550);
  }

  function collapseAll()
  {
    state.expanded.clear();

    const root = state.rootId;

    state.focusNode = root;

    setTimeout(() =>
    {
      scheduleCameraFocus(root);
    }, 50);

    getGraph()?.graphData(
      state.toForceGraph()
    );
  }
  
  
  return {
    handleNodeClick,
    selectAndExpandNode,
    focusRelatedNode,
    focusNode,
    showArtistConnections,
    collapseAll
  };
}
