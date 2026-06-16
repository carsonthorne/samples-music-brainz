import { loadGraph } from "./api/graphApi";
import { expandNode } from "./graph/expandNode";
import { createGraph } from "./graph/graphRenderer";
import { GraphState } from "./graph/graphState";

async function init()
{
  const container =
    document.getElementById("graph");

  const rawGraph =
    await loadGraph();

  const state =
    new GraphState(rawGraph);

  // seed with root artist ONLY
  const root =
    rawGraph.nodesById[
      Object.keys(rawGraph.nodesById)[0]
    ];

  state.addNode(root);

  const graph =
    createGraph(
      container,
      state,
      state.toForceGraph(),
      (node) => {
        expandNode(state, node.id);

        renderBreadcrumbs(state);

        graph.graphData(
          state.toForceGraph()
        );
      }
    );
}

function renderBreadcrumbs(state)
{
  const el = document.getElementById("breadcrumbs");

  const path =
    state.buildPath(state.focusNode);

  el.innerHTML = path
    .map(id =>
      `<span class="crumb">${state.graph.nodesById[id].name}</span>`
    )
    .join(" → ");
}

window.addEventListener("DOMContentLoaded", init);