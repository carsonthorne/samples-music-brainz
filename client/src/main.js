import "./style.css";
import {
  loadArtistConnections,
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

function setButtonLabel(button, label)
{
  button.setAttribute("aria-label", label);
  button.title = label;
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

function resultSortText(node)
{
  return String(node.name || node.title || node.label || "").toLocaleLowerCase();
}

function normalizeResultText(value)
{
  return String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/gi, " ")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

function resultRelevanceScore(query, node)
{
  const normalizedQuery = normalizeResultText(query);
  const normalizedValue = normalizeResultText(node.name || node.title || node.label || "");
  const compactQuery = normalizedQuery.replace(/\s+/g, "");
  const compactValue = normalizedValue.replace(/\s+/g, "");
  const hasTokenBreak = normalizedQuery.includes(" ");

  if (!normalizedQuery || !normalizedValue) return Number.MAX_SAFE_INTEGER;
  if (normalizedValue === normalizedQuery) return 0;
  if (compactQuery && compactValue === compactQuery)
  {
    return hasTokenBreak ? 30 + compactValue.length : 1;
  }
  if (normalizedValue.startsWith(normalizedQuery)) return 10 + normalizedValue.length;
  if (compactQuery && compactValue.startsWith(compactQuery))
  {
    return hasTokenBreak ? 150 + compactValue.length : 20 + compactValue.length;
  }

  const phraseIndex = normalizedValue.indexOf(normalizedQuery);
  if (phraseIndex !== -1) return 100 + phraseIndex + normalizedValue.length;

  const compactIndex = compactQuery ? compactValue.indexOf(compactQuery) : -1;
  if (compactIndex !== -1) return 200 + compactIndex + compactValue.length;

  let tokenPenalty = 0;
  for (const token of normalizedQuery.split(" ").filter(Boolean))
  {
    const tokenIndex = normalizedValue.indexOf(token);
    if (tokenIndex === -1) return Number.MAX_SAFE_INTEGER;
    tokenPenalty += tokenIndex;
  }

  return 300 + tokenPenalty + normalizedValue.length;
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
      loadArtistConnections,
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
    const isOrbiting = graph.isAutoOrbiting?.() || false;
    const isOrbitPending = Boolean(orbitStartTimer);
    const label =
      isOrbitPending ? "Fitting before orbit" : isOrbiting ? "Stop orbit" : "Start orbit";

    setButtonLabel(orbitToggle, label);
    orbitToggle.setAttribute("aria-pressed", String(isOrbiting || isOrbitPending));
  }

  function updatePanelToggle()
  {
    const visible =
      sidePanel?.isVisible?.() || false;

    setButtonLabel(panelToggleButton, visible ? "Hide panel" : "Show panel");
    panelToggleButton.setAttribute("aria-pressed", String(visible));
  }

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

  const typeSelect =
    document.getElementById("search-type");

  const resultsEl =
    document.getElementById("search-results");

  let predictiveSearchTimer = null;
  let predictiveSearchController = null;
  let searchRequestId = 0;
  let latestResults = [];

  function updateSearchPlaceholder()
  {
    const labelByType = {
      artist: "artists",
      album: "albums",
      track: "tracks"
    };

    input.placeholder = `Search ${labelByType[typeSelect.value] || "artists"}`;
  }

  function canPredictivelySearch(query)
  {
    if (typeSelect.value !== "track")
    {
      return query.length >= 2;
    }

    return query.length >= 5;
  }

  function predictiveSearchDelay()
  {
    return typeSelect.value === "track" ? 420 : 220;
  }

  function clearPredictiveSearchTimer()
  {
    if (!predictiveSearchTimer) return;

    clearTimeout(predictiveSearchTimer);
    predictiveSearchTimer = null;
  }

  function cancelPredictiveSearch()
  {
    clearPredictiveSearchTimer();

    if (predictiveSearchController)
    {
      predictiveSearchController.abort();
      predictiveSearchController = null;
    }
  }

  function renderSearchResults(results)
  {
    const selectedType = typeSelect.value;
    const query = input.value.trim();
    latestResults = results
      .filter((node) => node.type === selectedType)
      .sort((a, b) =>
        resultRelevanceScore(query, a) - resultRelevanceScore(query, b) ||
        (b.searchWeight || 0) - (a.searchWeight || 0) ||
        resultSortText(a).localeCompare(
          resultSortText(b),
          undefined,
          { sensitivity: "base" }
        )
      );

    resultsEl.innerHTML = latestResults
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
          latestResults[Number(button.dataset.index)];

        if (!node) return;

        cancelPredictiveSearch();
        resultsEl.innerHTML = "";
        await seedGraph(node);
      });
    });
  }

  async function runSearch(query, options = {})
  {
    const requestId = ++searchRequestId;
    const predictive = Boolean(options.predictive);
    const controller = predictive ? new AbortController() : null;

    if (predictive)
    {
      if (predictiveSearchController)
      {
        predictiveSearchController.abort();
      }

      predictiveSearchController = controller;
    }

    if (!predictive)
    {
      cancelPredictiveSearch();
      resultsEl.innerHTML = "";
      setStatus("Searching...");
    }

    try
    {
      const { results } =
        await searchGraphSeeds(
          query,
          {
            limit: predictive ? 8 : 30,
            perTypeLimit: predictive ? 4 : 10,
            type: typeSelect.value,
            predictive,
            signal: controller?.signal
          }
        );

      if (requestId !== searchRequestId) return;

      if (predictive && input.value.trim() !== query) return;

      const selectedResults =
        results.filter((node) => node.type === typeSelect.value);

      if (!selectedResults.length)
      {
        resultsEl.innerHTML = "";

        if (!predictive)
        {
          setStatus("No matches found.");
        }

        return;
      }

      setStatus("");
      renderSearchResults(selectedResults);
    }
    catch (err)
    {
      if (err.name === "AbortError") return;
      setStatus(err.message);
    }
    finally
    {
      if (predictive && predictiveSearchController === controller)
      {
        predictiveSearchController = null;
      }
    }
  }

  input.addEventListener("input", () =>
  {
    const query = input.value.trim();
    clearPredictiveSearchTimer();

    if (!canPredictivelySearch(query))
    {
      cancelPredictiveSearch();
      searchRequestId += 1;
      latestResults = [];
      resultsEl.innerHTML = "";
      return;
    }

    predictiveSearchTimer = setTimeout(() =>
    {
      predictiveSearchTimer = null;
      runSearch(query, { predictive: true });
    }, predictiveSearchDelay());
  });

  typeSelect.addEventListener("change", () =>
  {
    const query = input.value.trim();
    searchRequestId += 1;
    latestResults = [];
    updateSearchPlaceholder();
    cancelPredictiveSearch();
    resultsEl.innerHTML = "";

    if (canPredictivelySearch(query))
    {
      runSearch(query, { predictive: true });
    }
  });

  input.addEventListener("keydown", (event) =>
  {
    if (event.key !== "Escape") return;

    cancelPredictiveSearch();
    resultsEl.innerHTML = "";
  });

  form.addEventListener("submit", async (event) =>
  {
    event.preventDefault();

    const query = input.value.trim();
    if (!query) return;

    await runSearch(query);
  });

  updateSearchPlaceholder();

  document
    .getElementById("collapse-all")
    .addEventListener("click", async () =>
    {
      const rootNode = events.collapseAll();
      cancelPendingOrbitStart();
      graph.stopAutoOrbit?.();
      updateGraphControls();

      if (rootNode)
      {
        await sidePanel.open(rootNode);
      }

      updatePanelToggle();
    });
}

window.addEventListener("DOMContentLoaded", init);
