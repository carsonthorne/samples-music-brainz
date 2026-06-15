import ForceGraph3D from "3d-force-graph";

export function createGraph(
  container,
  graph,
  onNodeClick
)
{
  return ForceGraph3D()(container)
    .graphData(graph)
    .nodeLabel(
      node => `${node.type}: ${node.name}`
    )
    .nodeAutoColorBy("type")
    .linkDirectionalParticles(2)
    .linkDirectionalParticleSpeed(0.005)
    .onNodeClick(onNodeClick);
}