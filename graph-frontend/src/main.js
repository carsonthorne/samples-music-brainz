import { loadGraph } from "./api/graphApi";
import { createGraphEvents } from "./graph/graphEvents";
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
    // rawGraph.nodesById[
    //   Object.keys(rawGraph.nodesById)[0]
    // ];
    state.rootId;

  state.focusNode = root.id;

  let graph;

  const events =
    createGraphEvents(
      state,
      () => graph
    );

  graph =
    createGraph(
      container,
      state,
      state.toForceGraph(),
      events.handleNodeClick
    );
    
  events.bindBreadcrumbs();

  document
    .getElementById("expand-all")
    .addEventListener(
      "click",
      events.expandAll
    );

  document
    .getElementById("collapse-all")
    .addEventListener(
      "click",
      events.collapseAll
    );
}

window.addEventListener("DOMContentLoaded", init);