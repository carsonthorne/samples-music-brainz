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
      state.toForceGraph(),
      (node) => {
        expandNode(state, node.id);

        graph.graphData(
          state.toForceGraph()
        );
      }
    );
}

window.addEventListener("DOMContentLoaded", init);