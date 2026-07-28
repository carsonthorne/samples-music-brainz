export function getVisibleGraph(state)
{
  const visibleNodes = [];
  const visibleLinks = [];

  const visitedNodes = new Set();
  const visitedLinks = new Set(); // Prevent duplicate lines

  function traverse(nodeId)
  {
    if (visitedNodes.has(nodeId)) return;
    visitedNodes.add(nodeId);

    const node = state.graph.nodesById[nodeId];
    if (!node) return;
    if (node.renderHidden) return;

    visibleNodes.push(node);

    // Visibility is intentionally path-like: a node appears when its parent is
    // expanded, and its own children appear only after the user clicks it.
    if (!state.expanded.has(nodeId))
      return;

    function revealLink(source, target, type)
    {
      if (
        !state.graph.nodesById[source] ||
        !state.graph.nodesById[target] ||
        state.graph.nodesById[source].renderHidden ||
        state.graph.nodesById[target].renderHidden
      )
        return;

      const linkKey = `${source}|${target}|${type}`;

      if (!visitedLinks.has(linkKey))
      {
        visitedLinks.add(linkKey);
        visibleLinks.push({
          source,
          target,
          type
        });
      }
    }

    const forwardNeighbors =
      state.graph.adjacency[nodeId] || [];

    for (const edge of forwardNeighbors)
    {
      revealLink(nodeId, edge.target, edge.type);

      traverse(edge.target);
    }

    // Some relationships are meaningful from either side. For example, a track
    // can reveal music it sampled, and music that sampled it.
    const reverseNeighbors =
      state.graph.reverseAdjacency[nodeId] || [];

    for (const edge of reverseNeighbors)
    {
      revealLink(edge.source, nodeId, edge.type);

      traverse(edge.source);
    }
  }

  const root = state.rootId;
  if (root) 
  {
    traverse(root);
  }

  return {
    nodes: visibleNodes,
    links: visibleLinks,
  };
}
