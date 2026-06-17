export function collapseNode(state, nodeId)
{
  state.expanded.delete(nodeId);
}