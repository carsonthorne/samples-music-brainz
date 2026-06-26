export function collapseNode(state, nodeId) {
  const stack = [nodeId];

  while (stack.length) {
    const id = stack.pop();
    state.expanded.delete(id);

    const children = state.graph.adjacency[id] || [];
    for (const edge of children) {
      stack.push(edge.target);
    }
  }
}