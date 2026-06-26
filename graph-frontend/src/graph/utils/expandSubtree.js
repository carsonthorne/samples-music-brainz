export function expandSubtree(state, startNodeId) {
  const stack = [startNodeId];

  // prevents infinite loops in sample graph
  const visited = new Set();

  while (stack.length) {
    const nodeId = stack.pop();

    if (visited.has(nodeId)) continue;
    visited.add(nodeId);

    state.expanded.add(nodeId);

    const edges = state.graph.adjacency[nodeId] || [];

    for (const edge of edges) {
      const target = edge.target;

      // mark visible
      state.visibleNodes.add(target);
      state.visibleLinks.add(`${nodeId}->${target}`);

      stack.push(target);
    }
  }
}