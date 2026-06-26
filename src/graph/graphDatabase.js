class GraphDatabase {
  constructor() {

    this.NODE_TYPES = new Set([
      "artist",
      "release_group",
      "release",
      "track"
    ]);

    this.EDGE_TYPES = new Set([
      "RELEASES",
      "CONTAINS",
      "SAMPLES"
    ]);

    this.version = 1;
    this.generatedAt = new Date().toISOString();
    this.rootArtist = "A Tribe Called Quest";

    this.nodesById = new Map();

    this.adjacency = new Map();
    this.reverseAdjacency = new Map();

    this.nodeIds = new Set();
    this.edgeIds = new Set();
  }


  addNode(node) {
    if (!node?.id) return;

    // enforce type safety
    if (node.type && !this.NODE_TYPES.has(node.type)) {
      throw new Error(`Invalid node type: ${node.type}`);
    }

    if (this.nodeIds.has(node.id)) {
      const existing = this.nodesById.get(node.id);

      // Optional sanity check
      if (existing.type !== node.type) {
        console.warn(`[TYPE MISMATCH] ${node.id}`, existing.type, node.type);
      }

      return;
    }

    this.nodeIds.add(node.id);
    this.nodesById.set(node.id, node);
  }


  addLink(source, target, type) {
    if (!source || !target || !type) return;

    if (source === target) return;

    if (!this.EDGE_TYPES.has(type)) {
      throw new Error(`Invalid edge type: ${type}`);
    }

    const key = `${source}|${target}|${type}`;

    if (this.edgeIds.has(key)) return;
    this.edgeIds.add(key);

    // forward adjacency
    if (!this.adjacency.has(source)) this.adjacency.set(source, []);

    this.adjacency.get(source).push({
      target,
      type,
    });

    // reverse adjacency
    if (!this.reverseAdjacency.has(target)) {
      this.reverseAdjacency.set(target, []);
    }

    this.reverseAdjacency.get(target).push({
      source,
      type,
    });
  }

  
  getNeighbors(nodeId) {
    return this.adjacency.get(nodeId) || [];
  }


  getGraph() {
    const nodes = Array.from(this.nodesById.values());

    const links = [];

    for (const [source, edges] of this.adjacency.entries()) {
      for (const edge of edges) {
        links.push({
          source,
          target: edge.target,
          type: edge.type,
        });
      }
    }

    return {
      version: this.version,
      generatedAt: this.generatedAt,
      rootArtist: this.rootArtist,
      nodes,
      links,
      nodesById: Object.fromEntries(this.nodesById),
      adjacency: Object.fromEntries(this.adjacency),
      reverseAdjacency: Object.fromEntries(this.reverseAdjacency),
    };
  }
}

module.exports = GraphDatabase;
