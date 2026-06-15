class GraphStore
{
  constructor()
  {
    this.graph = {
      version: 1,
      generatedAt: new Date().toISOString(),
      rootArtist: "A Tribe Called Quest",
      nodes: [],
      links: []
    };

    this.nodeIds = new Set();
    this.linkIds = new Set();
  }

  addNode(node) 
  {
    if (this.nodeIds.has(node.id)) return;

    this.nodeIds.add(node.id);
    this.graph.nodes.push(node);
  }

  addLink(source, target, type)
  {
    const key = `${source}|${target}|${type}`;

    if (this.linkIds.has(key)) return;

    this.linkIds.add(key);
    this.graph.links.push({ source, target, type });
  }

  getGraph()
  {
    return {
      version: this.graph.version,
      generatedAt: this.graph.generatedAt,
      rootArtist: this.graph.rootArtist,
      nodes: [...this.graph.nodes],
      links: [...this.graph.links]
    };
  }
}

module.exports = GraphStore;