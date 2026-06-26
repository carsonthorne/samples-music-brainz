import { getVisibleGraph } from "./getVisibleGraph";

export class GraphState {
  constructor(graph, sampleIndex) {
    this.graph = graph;
    this.sampleIndex = sampleIndex;

    this.nodesById = Object.fromEntries(
      graph.nodes.map(n => [n.id, n])
    );

    this.rootId =
      graph.nodes.find(n => n.type === "artist")?.id
      ?? graph.nodes[0]?.id;

    this.expanded = new Set();
    this.focusNode = this.rootId;
    this.breadcrumbs = [];

    this.visibleNodes = new Set([this.rootId]);
    this.visibleLinks = new Set();
  }

  
  getSampleTargets(trackId) {
      return this.sampleIndex[trackId] || [];
  }


  setFocus(nodeId) {
    if (!nodeId) return;

    this.focusNode = nodeId;

    const last = this.breadcrumbs[this.breadcrumbs.length - 1];
    if (last !== nodeId) this.breadcrumbs.push(nodeId);
  }

  getBreadcrumbs() {
    return this.breadcrumbs;
  }

  toForceGraph() {
    return getVisibleGraph(this);
  }
}