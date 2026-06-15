export function expandNode(state, nodeId)
{
  if (state.expanded.has(nodeId))
    return [];

  state.expanded.add(nodeId);

  const neighbors =
    state.graph.adjacency[nodeId] || [];

  const newNodes = [];
  const newLinks = [];

  for (const edge of neighbors)
  {
    const targetId = edge.target;

    const targetNode =
      state.graph.nodesById[targetId];

    if (!targetNode) continue;

    state.addNode(targetNode);
    state.addLink(nodeId, targetId, edge.type);

    newNodes.push(targetNode);
    newLinks.push({
      source: nodeId,
      target: targetId,
      type: edge.type
    });
  }

  return { newNodes, newLinks };
}