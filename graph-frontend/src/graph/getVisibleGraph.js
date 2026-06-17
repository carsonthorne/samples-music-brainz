export function getVisibleGraph(state)
{
  const visibleNodes = [];
  const visibleLinks = [];

  const visited = new Set();


  function traverse(nodeId)
  {
    if (visited.has(nodeId)) return;
    visited.add(nodeId);

    const node = state.graph.nodesById[nodeId];
    if (!node) return;

    visibleNodes.push(node);

    if (!state.expanded.has(nodeId))
      return;

    const neighbors =
      state.graph.adjacency[nodeId] || [];

    for (const edge of neighbors)
    {
      visibleLinks.push({
        source: nodeId,
        target: edge.target,
        type: edge.type
      });

      traverse(edge.target);
    }
  }


  // IMPORTANT: start from root
  const root =
    state.rootId;

  traverse(root);

  return {
    nodes: visibleNodes,
    links: visibleLinks,
  };
}