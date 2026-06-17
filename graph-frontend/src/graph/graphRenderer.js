import ForceGraph3D from "3d-force-graph";

export function createGraph(container, state, graph, onNodeClick)
{
  const g = ForceGraph3D()(container)
    .graphData(graph)
    .nodeLabel(node => `${node.type}: ${node.name}`)
    .nodeAutoColorBy('type')
    .linkDirectionalParticles(2)
    .linkDirectionalParticleSpeed(0.005)
    .onNodeClick(onNodeClick)
    .nodeColor(node =>
    {
      if (node.id === state.focusNode)
        return "orange";

      if (state.expanded.has(node.id) && state.graph.adjacency[node.id]?.length)
        return "lightgreen";

      if (state.graph.adjacency[node.id]?.length)
        return "gold";

      return "steelblue";
    })

  return g;
}