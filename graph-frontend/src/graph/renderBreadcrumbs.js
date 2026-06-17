export function renderBreadcrumbs(state, onBreadcrumbClick)
{
  const el =
    document.getElementById("breadcrumbs");

  const path =
    state.buildPath();

  el.innerHTML = path
    .map(id =>
      `<span class="crumb" data-id="${id}">
        ${state.graph.nodesById[id]?.name ?? id}
      </span>`
    )
    .join(" → ");
}