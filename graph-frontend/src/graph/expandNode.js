export function expandNode(state, nodeId)
{
  if (state.expanded.has(nodeId))
    return;

  state.expanded.add(nodeId);
}