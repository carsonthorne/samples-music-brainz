export function renderBreadcrumbs(state, onBreadcrumbClick)
{
  const el =
    document.getElementById("breadcrumbs");

  const path =
    state.getBreadcrumbs()

  el.innerHTML = path
    .map(id =>
      `<span class="crumb" data-id="${id}">
        ${state.graph.nodesById[id]?.name ?? id}
      </span>`
    )
    .join(" → ");
}