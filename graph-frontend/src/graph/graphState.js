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

    this.breadcrumbParentMap = new Map();
  }

  
  buildPath(nodeId)
  {
    const path = [];
  
    let current = nodeId;
  
    while (current)
    {
      path.unshift(current);
  
      current =
        this.breadcrumbParentMap.get(current);
    }
  
    return path;
  }


  getBreadcrumbs()
  {
    return this.breadcrumbs;
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