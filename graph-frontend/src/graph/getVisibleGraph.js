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

    visibleNodes.push(node);

    // If this node isn't clicked/expanded, don't expose its neighbors
    if (!state.expanded.has(nodeId))
      return;

    // CRAWL FORWARD (Downstream: Artist -> Album -> Track -> Sample)
    const forwardNeighbors =
      state.graph.adjacency[nodeId] || [];

    for (const edge of forwardNeighbors)
    {
      const linkKey = `${nodeId}|${edge.target}|${edge.type}`;
      
      if (!visitedLinks.has(linkKey))
      {
        visitedLinks.add(linkKey);
        visibleLinks.push({
          source: nodeId,
          target: edge.target,
          type: edge.type
        });
      }

      traverse(edge.target);
    }

    // CRAWL BACKWARD (Upstream: Sample Track -> Sample Album -> Sample Artist)
    const backwardNeighbors =
      state.graph.reverseAdjacency[nodeId] || [];

    for (const edge of backwardNeighbors)
    {
      const linkKey = `${edge.source}|${nodeId}|${edge.type}`;

      if (!visitedLinks.has(linkKey))
      {
        visitedLinks.add(linkKey);
        visibleLinks.push({
          source: edge.source, // Keep original structural orientation
          target: nodeId,
          type: edge.type
        });
      }

      traverse(edge.source);
    }
  }

  // Start the web reveal from your root artist
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