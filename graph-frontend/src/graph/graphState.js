export class GraphState
{
  constructor(graph)
  {
    this.graph = graph;

    // active graph
    this.nodes = new Map();
    this.links = new Set();

    // expansion tracking
    this.expanded = new Set();

  }


  addNode(node)
  {
    this.nodes.set(node.id, node);
  }


  addLink(source, target, type)
  {
    const key = `${source}|${target}|${type}`;
    if (this.links.has(key)) return;

    this.links.add(key);
  }


  toForceGraph()
  {
    return {
      nodes: Array.from(this.nodes.values()),
      links: Array.from(this.links).map(k => {
        const [source, target, type] = k.split("|");
        return { source, target, type };
      })
    };
  }
}