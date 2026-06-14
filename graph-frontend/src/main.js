import ForceGraph3D from '3d-force-graph';

async function init() {
  try {
    const container = document.getElementById('graph');
    if (!container) {
      throw new Error("Graph container div not found");
    }

    const res = await fetch('./data/graph.json');
    const graph = await res.json();

    ForceGraph3D()(container)
      .graphData(graph)
      .nodeLabel(node => `${node.type}: ${node.name}`)
      .nodeAutoColorBy('type')
      .linkDirectionalParticles(2)
      .linkDirectionalParticleSpeed(0.005)
      .onNodeClick(node => {
        const links = graph.links.filter(
          link =>
            link.source.id === node.id ||
            link.target.id === node.id ||
            link.source === node.id ||
            link.target === node.id
        );
      
        console.log(node);
        console.log(links);
      });
    } catch (err) {
      console.error(err);
    }  
}

window.addEventListener('DOMContentLoaded', init);
