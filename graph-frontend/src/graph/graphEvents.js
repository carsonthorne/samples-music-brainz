import { expandNode } from "./expandNode";
import { renderBreadcrumbs } from "./renderBreadcrumbs";

export function createGraphEvents(
  state,
  getGraph
)
{
  function handleNodeClick(node)
  {
    expandNode(state, node.id);

    renderBreadcrumbs(state, 
      handleBreadcrumbClick
    );

    getGraph().graphData(
      state.toForceGraph()
    );
  }


  function handleBreadcrumbClick(nodeId)
  {
    state.setFocus(nodeId);

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
  

  return {
    handleNodeClick,
    handleBreadcrumbClick,
    bindBreadcrumbs
  };
}