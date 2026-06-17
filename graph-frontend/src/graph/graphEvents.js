import { collapseNode } from "./collapseNode";
import { expandNode } from "./expandNode";
import { renderBreadcrumbs } from "./renderBreadcrumbs";

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
    state.setFocus(nodeId);

    focusCameraOnNode(nodeId);

    renderBreadcrumbs(
      state,
      handleBreadcrumbClick
    );

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
        z: node.z + 200 // zoom out a bit so we see context
      },
      node,
      1000 // animation duration (ms)
    );
  }


  function expandAll()
  {
    // for (const id of Object.keys(
    //   state.graph.nodesById
    // ))
    // {
    //   state.expanded.add(id);
    // }
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

    state.setFocus(
      state.rootId
    );

    renderBreadcrumbs(
      state,
      handleBreadcrumbClick
    );

    getGraph().graphData(
      state.toForceGraph()
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