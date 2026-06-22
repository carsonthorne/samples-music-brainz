class GraphDatabase
{
  constructor()
  {
    this.version = 1;
    this.generatedAt = new Date().toISOString();
    this.rootArtist = "A Tribe Called Quest";

    this.nodesById = new Map();

    this.adjacency = new Map();
    this.reverseAdjacency = new Map();

    this.nodeIds = new Set();
    this.edgeIds = new Set();

    this.trackRegistry = new Map();
  }

  registerTrackTitle(albumId, title, trackId)
  {
    if (!albumId || !title) return;
    const key = `${albumId}|${title.toLowerCase().trim()}`;
    if (!this.trackRegistry.has(key)) 
    {
      this.trackRegistry.set(key, trackId);
    }
  }


  getTrackIdByTitle(albumId, title)
  {
    if (!albumId || !title) return null;
    const key = `${albumId}|${title.toLowerCase().trim()}`;
    return this.trackRegistry.get(key) || null;
  }


  addNode(node)
  {
    if (this.nodeIds.has(node.id)) return;

    this.nodeIds.add(node.id);

    this.nodesById.set(node.id, node);
  }


  addLink(source, target, type)
  {
    const key = `${source}|${target}|${type}`;

    if (this.edgeIds.has(key)) return;
    this.edgeIds.add(key);

    // forward adjacency
    if (!this.adjacency.has(source))
      this.adjacency.set(source, []);

    this.adjacency.get(source).push({
      target,
      type
    });

    // reverse adjacency
    if (!this.reverseAdjacency.has(target))
    {
      this.reverseAdjacency.set(target, []);
    }

    this.reverseAdjacency.get(target).push({
      source,
      type
    });
  }

  
  getNeighbors(nodeId)
  {
    return this.adjacency.get(nodeId) || [];
  }


  getGraph()
  {
    const nodes = Array.from(this.nodesById.values());

    const links = [];

    for (const [source, edges] of this.adjacency.entries())
    {
      for (const edge of edges)
      {
        links.push({
          source,
          target: edge.target,
          type: edge.type
        });
      }
    }

    return {
      version: this.version,
      generatedAt: this.generatedAt,
      rootArtist: this.rootArtist,
      nodesById: Object.fromEntries(this.nodesById),
      adjacency: Object.fromEntries(this.adjacency),
      reverseAdjacency: Object.fromEntries(this.reverseAdjacency),
      nodes,
      links
    };
  }
}

module.exports = GraphDatabase;