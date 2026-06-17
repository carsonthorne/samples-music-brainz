import { getVisibleGraph } from "./getVisibleGraph";

export class GraphState
{
  constructor(graph)
  {
    this.graph = graph;

    this.rootId = Object.keys(graph.nodesById)[0];

    this.expanded = new Set();

    this.focusNode = null;

    this.breadcrumbs = [];
  }

  
  buildPath(nodeId)
  {
    return this.breadcrumbs;
  }


  getBreadcrumbs()
  {
    return this.breadcrumbs;
  }

  
  setFocus(nodeId)
  {
    this.focusNode = nodeId;

    // avoid duplicate consecutive entries
    const last =
      this.breadcrumbs[this.breadcrumbs.length - 1];

    if (last === nodeId)
      return;

    this.breadcrumbs.push(nodeId);
  }


  toForceGraph()
  {
    return getVisibleGraph(this);
  }
}