import "./style.css";
import {
  loadNodeDetails,
  loadNodeNeighbors,
  searchGraphSeeds
} from "./api/graphApi";
import { createGraphEvents } from "./graph/graphEvents";
import { createGraph } from "./graph/graphRenderer";
import { GraphState } from "./graph/graphState";
import { createSidePanel } from "./ui/sidePanel";

function setStatus(message)
{
  document.getElementById("status").textContent = message || "";
}

function escapeHtml(value)
{
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function resultLabel(node)
{
  const type = node.type[0].toUpperCase() + node.type.slice(1);
  const artist = node.artistName || node.artistNames || "";
  const title = artist ? `${node.name} by ${artist}` : node.name;
  const detail =
    node.disambiguation || node.firstReleaseDate || "";
  return `${type}: ${title}${detail ? ` (${detail})` : ""}`;
}

function visibleConnectionEntries(state)
{
  const visible = state.toForceGraph();
  const nodesById =
    Object.fromEntries((visible.nodes || []).map((node) => [node.id, node]));
  const neighbors = {};

  for (const node of visible.nodes || [])
  {
    neighbors[node.id] = [];
  }

  for (const link of visible.links || [])
  {
    const source =
      typeof link.source === "object" ? link.source.id : link.source;
    const target =
      typeof link.target === "object" ? link.target.id : link.target;

    if (!nodesById[source] || !nodesById[target]) continue;

    neighbors[source].push(target);
    neighbors[target].push(source);
  }

  const focusId =
    state.focusNode || state.rootId;
  const queue = focusId && nodesById[focusId] ? [focusId] : [];
  const paths = {};

  if (queue.length)
  {
    paths[focusId] = [focusId];
  }

  while (queue.length)
  {
    const nodeId = queue.shift();

    for (const nextId of neighbors[nodeId] || [])
    {
      if (paths[nextId]) continue;
      paths[nextId] = [...paths[nodeId], nextId];
      queue.push(nextId);
    }
  }

  return (visible.nodes || []).map((node) => ({
    node,
    path: (paths[node.id] || [node.id]).map((nodeId) => nodesById[nodeId])
      .filter(Boolean)
  }));
}

async function init()
{
  const container =
    document.getElementById("graph");

  const state =
    new GraphState();

  let graph;
  let sidePanel;

  const events =
    createGraphEvents(
      state,
      () => graph,
      loadNodeNeighbors,
      setStatus,
      (node, options = {}) =>
      {
        if (options.fromHistory)
        {
          sidePanel?.openFromHistory(node);
        }
        else
        {
          sidePanel?.open(node);
        }

        updatePanelToggle();
      }
    );

  sidePanel =
    createSidePanel({
      loadDetails: loadNodeDetails,
      getConnections()
      {
        return visibleConnectionEntries(state);
      },
      setStatus,
      async onItemClick(node, parentNode, options = {})
      {
        await events.focusRelatedNode(parentNode, node, options);
      },
      onConnectionClick(node)
      {
        if (node?.id)
        {
          events.focusNode(node.id);
        }
      },
      async onHistoryNavigate(node)
      {
        await events.selectAndExpandNode(node, {
          forceExpand: true,
          fromHistory: true
        });
      },
      async onShowArtistConnections()
      {
        await events.showArtistConnections();
      }
    });

  graph =
    createGraph(
      container,
      state,
      state.toForceGraph(),
      events.handleNodeClick
    );

  const viewToggle =
    document.getElementById("toggle-view");

  const dagToggle =
    document.getElementById("toggle-dag");

  const fitCanvasButton =
    document.getElementById("fit-canvas");

  const orbitToggle =
    document.getElementById("toggle-orbit");

  const panelToggleButton =
    document.getElementById("toggle-panel");

  let orbitStartTimer = null;

  function cancelPendingOrbitStart()
  {
    if (!orbitStartTimer) return;

    clearTimeout(orbitStartTimer);
    orbitStartTimer = null;
  }

  function updateGraphControls()
  {
    const is2d = graph.getViewMode() === "2d";
    const isDag = graph.getDagEnabled();
    const isOrbiting = graph.isAutoOrbiting?.() || false;
    const isOrbitPending = Boolean(orbitStartTimer);

    viewToggle.textContent = is2d ? "3D View" : "2D View";
    viewToggle.setAttribute("aria-pressed", String(is2d));

    dagToggle.textContent = isDag ? "DAG On" : "DAG Off";
    dagToggle.setAttribute("aria-pressed", String(isDag));

    orbitToggle.textContent =
      isOrbitPending ? "Fitting..." : isOrbiting ? "Orbit On" : "Orbit";
    orbitToggle.setAttribute("aria-pressed", String(isOrbiting || isOrbitPending));
  }

  function updatePanelToggle()
  {
    const visible =
      sidePanel?.isVisible?.() || false;

    panelToggleButton.textContent = visible ? "Hide Panel" : "Show Panel";
    panelToggleButton.setAttribute("aria-pressed", String(visible));
  }

  viewToggle.addEventListener("click", () =>
  {
    cancelPendingOrbitStart();
    const nextMode =
      graph.getViewMode() === "3d" ? "2d" : "3d";

    graph.setViewMode(nextMode);
    graph.graphData(state.toForceGraph());
    updateGraphControls();
  });

  dagToggle.addEventListener("click", () =>
  {
    graph.setDagEnabled(!graph.getDagEnabled());
    updateGraphControls();
  });

  fitCanvasButton.addEventListener("click", () =>
  {
    graph.fitToCanvas?.(900);
  });

  orbitToggle.addEventListener("click", () =>
  {
    if (graph.isAutoOrbiting?.() || orbitStartTimer)
    {
      cancelPendingOrbitStart();
      graph.stopAutoOrbit?.();
      updateGraphControls();
      return;
    }

    graph.fitToCanvas?.(900);
    orbitStartTimer = setTimeout(() =>
    {
      graph.startAutoOrbit?.();
      orbitStartTimer = null;
      updateGraphControls();
    }, 950);
    updateGraphControls();
  });

  container.addEventListener("samplegraph:orbitchange", updateGraphControls);

  panelToggleButton.addEventListener("click", () =>
  {
    sidePanel.toggle();
    updatePanelToggle();
  });

  updateGraphControls();
  updatePanelToggle();

  async function seedGraph(node)
  {
    try
    {
      setStatus("Loading graph...");
      state.resetToSeed(node);

      graph.graphData(
        state.toForceGraph()
      );

      events.focusNode(node.id);
      setStatus("");
    }
    catch (err)
    {
      setStatus(err.message);
    }
  }

  const form =
    document.getElementById("search-form");

  const input =
    document.getElementById("search-input");

  const resultsEl =
    document.getElementById("search-results");

  form.addEventListener("submit", async (event) =>
  {
    event.preventDefault();

    const query = input.value.trim();
    if (!query) return;

    resultsEl.innerHTML = "";
    setStatus("Searching...");

    try
    {
      const { results } =
        await searchGraphSeeds(query);

      if (!results.length)
      {
        setStatus("No matches found.");
        return;
      }

      setStatus("");
      resultsEl.innerHTML = results
        .map((node, index) =>
          `<button class="result" type="button" data-index="${index}">
            ${escapeHtml(resultLabel(node))}
          </button>`
        )
        .join("");

      resultsEl.querySelectorAll(".result").forEach((button) =>
      {
        button.addEventListener("click", async () =>
        {
          const node =
            results[Number(button.dataset.index)];

          resultsEl.innerHTML = "";
          await seedGraph(node);
        });
      });
    }
    catch (err)
    {
      setStatus(err.message);
    }
  });

  document
    .getElementById("collapse-all")
    .addEventListener("click", () =>
    {
      events.collapseAll();
      cancelPendingOrbitStart();
      graph.stopAutoOrbit?.();
      updateGraphControls();
      sidePanel.close();
      updatePanelToggle();
    });
}

window.addEventListener("DOMContentLoaded", init);
