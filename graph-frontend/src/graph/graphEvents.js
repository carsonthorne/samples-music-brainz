import { collapseNode } from "./collapseNode";
import { expandNode } from "./expandNode";
import { renderBreadcrumbs } from "./renderBreadcrumbs";
import getLineage from "./utils/getLineage"; // <-- 1. Import your lineage calculator

export function createGraphEvents(
  state,
  getGraph
)
{
  function handleNodeClick(node)
  {
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

  function expandAll()
  {
    state.expanded =
      new Set(
        Object.keys(state.graph.nodesById)
      );

    getGraph().graphData(
      state.toForceGraph()
    );
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