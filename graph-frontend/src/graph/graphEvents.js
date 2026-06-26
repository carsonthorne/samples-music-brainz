import { collapseNode } from "./collapseNode";
import { expandNode } from "./expandNode";
import { renderBreadcrumbs } from "./renderBreadcrumbs";
import { expandSubtree } from "./utils/expandSubtree";
import getLineage from "./utils/getLineage"; // <-- 1. Import your lineage calculator

export function createGraphEvents(
  state,
  getGraph
)
{
  function handleNodeClick(node)
  {
    console.log("CLICKED", node.id);
    console.log("Expanded before:", state.expanded.has(node.id));

    if (state.expanded.has(node.id))
    {
      collapseNode(state, node.id);
    }
    else
    {
      expandNode(state, node.id);
    }

    state.setFocus(node.id);
    
    if (state.graph && state.graph.reverseAdjacency)
    {
      state.breadcrumbs = getLineage(state.graph, node.id);
    }

    getGraph().graphData(
      state.toForceGraph()
    );

    focusCameraOnNode(node.id);

    renderBreadcrumbs(state, 
      handleBreadcrumbClick
    );
  }


  function handleBreadcrumbClick(nodeId)
  {
    const index =
      state.breadcrumbs.indexOf(nodeId);

    if (index === -1)
      return;

    // truncate history
    state.breadcrumbs =
      state.breadcrumbs.slice(0, index + 1);

    state.setFocus(nodeId);

    focusCameraOnNode(nodeId);

    renderBreadcrumbs(state, handleBreadcrumbClick);

    getGraph().graphData(
      state.toForceGraph()
    );
  }


  function bindBreadcrumbs()
  {
    const el =
      document.getElementById("breadcrumbs");

    el.addEventListener("click", (e) =>
    {
      const crumb =
        e.target.closest(".crumb");

      if (!crumb) return;

      handleBreadcrumbClick(
        crumb.dataset.id
      );
    });
  }
  

  function focusCameraOnNode(nodeId)
  {
    const graph = getGraph();
    if (!graph) return;

    // const nodeMap = new Map(state.graph.nodes.map(n => [n.id, n]));
    // const node = nodeMap.get(nodeId);

    // const node = graph.graphData().nodes.find(n => n.id === nodeId);
    const node = state.graph.nodesById[nodeId];
    if (!node) return;

    graph.cameraPosition(
      {
        x: node.x,
        y: node.y,
        z: node.z + 200
      },
      node,
      3000
    );
  }

  function expandAll() {
    state.expanded.clear();
    state.visibleNodes.clear();
    state.visibleLinks.clear();

    expandSubtree(state, state.rootId);

    getGraph().graphData(state.toForceGraph());
  }
  
  function collapseAll()
  {
    state.expanded.clear();

    const root = state.rootId;

    state.focusNode = root;
    state.breadcrumbs = [];

    setTimeout(() =>
    {
      focusCameraOnNode(root);
    }, 50);

    getGraph().graphData(
      state.toForceGraph()
    );

    renderBreadcrumbs(
      state,
      handleBreadcrumbClick
    );
  }
  
  
  return {
    handleNodeClick,
    handleBreadcrumbClick,
    bindBreadcrumbs,
    expandAll,
    collapseAll
  };
}