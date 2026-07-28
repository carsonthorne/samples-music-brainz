import { getVisibleGraph } from "./getVisibleGraph";

export class GraphState
{
  constructor(graph = null)
  {
    this.graph = graph || {
      version: 1,
      generatedAt: new Date().toISOString(),
      nodesById: {},
      adjacency: {},
      reverseAdjacency: {},
      nodes: [],
      links: []
    };

    this.rootId = Object.keys(this.graph.nodesById)[0] || null;
    this.expanded = new Set();
    this.focusNode = null;
    this.loadedNeighbors = new Set();
    this.expansionModes = {};
    this.linkKeys = new Set(
      (this.graph.links || []).map((link) =>
        `${typeof link.source === "object" ? link.source.id : link.source}|${typeof link.target === "object" ? link.target.id : link.target}|${link.type || "related"}`
      )
    );
    this.adjacencyKeys = new Set();
    this.reverseAdjacencyKeys = new Set();

    for (const [source, edges] of Object.entries(this.graph.adjacency || {}))
    {
      for (const edge of edges || [])
      {
        this.adjacencyKeys.add(`${source}|${edge.target}|${edge.type}`);
      }
    }

    for (const [target, edges] of Object.entries(this.graph.reverseAdjacency || {}))
    {
      for (const edge of edges || [])
      {
        this.reverseAdjacencyKeys.add(`${target}|${edge.source}|${edge.type}`);
      }
    }
  }

  resetToSeed(node)
  {
    this.graph = {
      version: 1,
      generatedAt: new Date().toISOString(),
      nodesById: {},
      adjacency: {},
      reverseAdjacency: {},
      nodes: [],
      links: []
    };

    this.expanded.clear();
    this.loadedNeighbors.clear();
    this.expansionModes = {};
    this.linkKeys.clear();
    this.adjacencyKeys.clear();
    this.reverseAdjacencyKeys.clear();
    this.addNode(node);
    this.setExpansionMode(node.id, node.nextExpansion);
    this.rootId = node.id;
    this.focusNode = node.id;
  }

  addNode(node)
  {
    if (!node || !node.id) return;
    const existing = this.graph.nodesById[node.id];
    const merged = {
      ...(existing || {}),
      ...node
    };

    // API responses can re-send a parent node after ForceGraph has assigned it
    // layout coordinates. Preserve those live coordinates so nodes do not jump
    // or disappear when their children are merged in.
    for (const key of ["x", "y", "z", "vx", "vy", "vz", "fx", "fy", "fz"])
    {
      if (node[key] === undefined && existing?.[key] !== undefined)
      {
        merged[key] = existing[key];
      }
    }

    this.graph.nodesById[node.id] = merged;
    this.graph.nodes = Object.values(this.graph.nodesById);

    if (node.nextExpansion)
    {
      this.setExpansionMode(node.id, node.nextExpansion);
    }
  }

  addLink(link)
  {
    if (!link || !link.source || !link.target) return;

    const source = typeof link.source === "object" ? link.source.id : link.source;
    const target = typeof link.target === "object" ? link.target.id : link.target;
    const type = link.type || "related";
    const linkKey = `${source}|${target}|${type}`;

    if (!this.linkKeys.has(linkKey))
    {
      this.linkKeys.add(linkKey);
      this.graph.links.push({
        ...link,
        source,
        target,
        type
      });
    }

    this.graph.adjacency[source] ||= [];
    const adjacencyKey = `${source}|${target}|${type}`;
    if (!this.adjacencyKeys.has(adjacencyKey))
    {
      this.adjacencyKeys.add(adjacencyKey);
      this.graph.adjacency[source].push({
        target,
        type
      });
    }

    this.graph.reverseAdjacency[target] ||= [];
    const reverseAdjacencyKey = `${target}|${source}|${type}`;
    if (!this.reverseAdjacencyKeys.has(reverseAdjacencyKey))
    {
      this.reverseAdjacencyKeys.add(reverseAdjacencyKey);
      this.graph.reverseAdjacency[target].push({
        source,
        type
      });
    }
  }

  mergeFragment(fragment)
  {
    if (!fragment) return;
    this.addNode(fragment.parent);

    for (const node of fragment.nodes || [])
    {
      this.addNode(node);
    }

    for (const link of fragment.links || [])
    {
      this.addLink(link);
    }

    for (const [nodeId, mode] of Object.entries(fragment.nodeModes || {}))
    {
      this.setExpansionMode(nodeId, mode);
    }
  }

  markNeighborsLoaded(nodeId)
  {
    this.loadedNeighbors.add(nodeId);
  }

  hasLoadedNeighbors(nodeId)
  {
    return this.loadedNeighbors.has(nodeId);
  }

  setExpansionMode(nodeId, mode)
  {
    if (!nodeId || !mode) return;
    this.expansionModes[nodeId] = mode;
  }

  getExpansionMode(nodeId)
  {
    return this.expansionModes[nodeId] || null;
  }

  
  setFocus(nodeId)
  {
    this.focusNode = nodeId;
  }


  toForceGraph()
  {
    return getVisibleGraph(this);
  }
}
