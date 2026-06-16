export function expandNode(state, nodeId)
{
  state.focusNode = nodeId;

  if (state.expanded.has(nodeId))
    return;

  state.expanded.add(nodeId);
}