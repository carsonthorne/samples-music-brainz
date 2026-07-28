const PLACEHOLDER_TEXT = {
  artist: "Artist image unavailable",
  album: "Album artwork unavailable",
  track: "Album artwork unavailable"
};

function escapeHtml(value)
{
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function itemDetail(item)
{
  if (item.artistName && item.relationshipType)
  {
    return `${item.artistName} - ${item.relationshipType}`;
  }

  if (item.artistName)
  {
    return item.artistName;
  }

  return item.trackNumber || item.firstReleaseDate || item.disambiguation || item.relationshipType || "";
}

function nodeLabel(node)
{
  return node?.name || node?.label || node?.id || "";
}

function detailSections(details)
{
  if (Array.isArray(details.sections) && details.sections.length)
  {
    return details.sections;
  }

  return [
    {
      label: details.listLabel || "Connections",
      items: details.items || []
    }
  ];
}

function focusMetaLinks(details)
{
  const { node } = details;
  const links = [];

  if (node.type === "album")
  {
    for (const artist of details.artists || [])
    {
      links.push({
        label: "By",
        node: {
          ...artist,
          parentExpansionMode: "album_artists"
        }
      });
    }
  }

  if (node.type === "track")
  {
    if (details.album)
    {
      links.push({
        label: "From",
        node: {
          ...details.album,
          parentExpansionMode: "track_albums"
        }
      });
    }

    for (const artist of details.artists || [])
    {
      links.push({
        label: "By",
        node: {
          ...artist,
          expansionPath: [
            { node, mode: "track_albums" },
            ...(details.album
              ? [{ node: details.album, mode: "album_artists" }]
              : [])
          ]
        }
      });
    }
  }

  return links;
}

function placeholderText(type)
{
  return PLACEHOLDER_TEXT[type] || "Image unavailable";
}

function artworkHtml(node, image)
{
  if (!image)
  {
    return `<div class="panel-artwork-placeholder">${escapeHtml(placeholderText(node.type))}</div>`;
  }

  return `
    <div class="panel-artwork-loading" aria-live="polite">Loading image...</div>
    <img
      class="panel-artwork-image"
      src="${escapeHtml(image)}"
      alt=""
      data-src="${escapeHtml(image)}"
      data-placeholder="${escapeHtml(placeholderText(node.type))}"
    >
  `;
}

function cacheBustedImageUrl(src)
{
  const separator = src.includes("?") ? "&" : "?";
  return `${src}${separator}t=${Date.now()}`;
}

function bindArtworkFallback(container = document)
{
  const image = container.querySelector(".panel-artwork-image");
  if (!image) return;

  const parent = image.closest(".panel-artwork");
  const baseSrc = image.dataset.src || image.src;
  let attempts = 0;

  image.addEventListener("load", () =>
  {
    parent?.classList.add("is-loaded");
  });

  image.addEventListener("error", () =>
  {
    if (!parent) return;

    attempts++;

    if (attempts <= 5)
    {
      setTimeout(() =>
      {
        image.src = cacheBustedImageUrl(baseSrc);
      }, attempts * 300);
      return;
    }

    parent.classList.remove("is-loaded");
    parent.innerHTML =
      `<div class="panel-artwork-placeholder">${escapeHtml(image.dataset.placeholder)}</div>`;
  });

  if (image.complete && image.naturalWidth > 0)
  {
    parent?.classList.add("is-loaded");
  }
}

export function createSidePanel({
  loadDetails,
  getConnections,
  onItemClick,
  onConnectionClick,
  onHistoryNavigate,
  onShowArtistConnections,
  setStatus
})
{
  const panel = document.getElementById("details-panel");
  const body = document.getElementById("details-panel-body");
  const backButton = document.getElementById("details-panel-back");
  const forwardButton = document.getElementById("details-panel-forward");
  const connectionsButton = document.getElementById("details-panel-connections");
  let selectedNodeId = null;
  let selectedDetails = null;
  let currentItems = new Map();
  let history = [];
  let historyIndex = -1;
  let runId = 0;
  let activeTab = "focus";

  function updateNavButtons()
  {
    backButton.disabled = historyIndex <= 0;
    forwardButton.disabled = historyIndex < 0 || historyIndex >= history.length - 1;
  }

  function remember(node)
  {
    if (!node?.id || history[historyIndex]?.id === node.id)
    {
      updateNavButtons();
      return;
    }

    history = history.slice(0, historyIndex + 1);
    history.push(node);
    historyIndex = history.length - 1;
    updateNavButtons();
  }

  function close()
  {
    selectedNodeId = null;
    selectedDetails = null;
    panel.hidden = true;
    body.innerHTML = "";
    updateNavButtons();
  }

  function showNoFocus()
  {
    selectedNodeId = null;
    selectedDetails = null;
    currentItems = new Map();
    panel.hidden = false;
    body.innerHTML = `<div class="panel-empty">No focused node.</div>`;
    updateNavButtons();
  }

  function hide()
  {
    panel.hidden = true;
  }

  function show()
  {
    if (!selectedNodeId && !body.innerHTML)
    {
      showNoFocus();
      return;
    }

    panel.hidden = false;
  }

  function toggle()
  {
    if (panel.hidden)
    {
      show();
    }
    else
    {
      hide();
    }

    return !panel.hidden;
  }

  function loading(node)
  {
    panel.hidden = false;
    body.innerHTML = `
      <div class="panel-loading">
        Loading ${escapeHtml(node.name || node.label || node.id)}...
      </div>
    `;
  }

  function tabHtml()
  {
    return `
      <div class="panel-tabs" role="tablist" aria-label="Side panel views">
        <button
          class="panel-tab"
          type="button"
          data-tab="focus"
          aria-selected="${activeTab === "focus"}"
        >
          Focus
        </button>
        <button
          class="panel-tab"
          type="button"
          data-tab="connections"
          aria-selected="${activeTab === "connections"}"
        >
          Connections
        </button>
      </div>
    `;
  }

  function focusTabHtml(details)
  {
    const { node, image } = details;
    const sections = detailSections(details);
    const metaLinks = focusMetaLinks(details);
    currentItems = new Map([
      ...metaLinks.map((entry) => [entry.node.id, entry.node]),
      ...sections.flatMap((section) =>
        (section.items || []).map((item) => [item.id, item])
      )
    ]);

    const meta =
      node.type === "artist"
        ? node.disambiguation || ""
        : node.firstReleaseDate || node.disambiguation || "";

    return `
      ${tabHtml()}
      <div class="panel-artwork">
        ${artworkHtml(node, image)}
      </div>

      <div class="panel-heading">
        <div class="panel-type">${escapeHtml(node.type)}</div>
        <h2>${escapeHtml(node.name || node.label || node.id)}</h2>
        ${meta ? `<p>${escapeHtml(meta)}</p>` : ""}
        ${metaLinksHtml(metaLinks)}
      </div>

      ${sections.map(sectionHtml).join("")}
    `;
  }

  function metaLinksHtml(links)
  {
    if (!links.length) return "";

    return `
      <div class="panel-meta-links">
        ${links.map(({ label, node }) => `
          <div class="panel-meta-row">
            <span>${escapeHtml(label)}</span>
            <button
              class="panel-meta-node"
              type="button"
              data-node-id="${escapeHtml(node.id)}"
            >
              ${escapeHtml(nodeLabel(node))}
            </button>
          </div>
        `).join("")}
      </div>
    `;
  }

  function sectionHtml(section)
  {
    const items = section.items || [];

    return `
      <div class="panel-list">
        <h3>${escapeHtml(section.label || "Connections")}</h3>
        ${
          items.length
            ? items.map((item) => `
                <button class="panel-list-item" type="button" data-node-id="${escapeHtml(item.id)}">
                  <span>${escapeHtml(item.name || item.label || item.id)}</span>
                  ${itemDetail(item) ? `<small>${escapeHtml(itemDetail(item))}</small>` : ""}
                </button>
              `).join("")
            : `<div class="panel-empty">No items found.</div>`
        }
      </div>
    `;
  }

  function connectionGroups()
  {
    const entries = getConnections?.() || [];
    const groups = {
      artist: [],
      album: [],
      track: []
    };

    for (const entry of entries)
    {
      const node = entry.node || entry;
      if (groups[node.type])
      {
        groups[node.type].push({
          node,
          path: entry.path || [node]
        });
      }
    }

    for (const list of Object.values(groups))
    {
      list.sort((a, b) =>
        String(nodeLabel(a.node))
          .localeCompare(String(nodeLabel(b.node)))
      );
    }

    return groups;
  }

  function pathHtml(path)
  {
    return `
      <ol class="panel-connection-path">
        ${path.map((node) => `
          <li>
            <button
              class="panel-path-node"
              type="button"
              data-node-id="${escapeHtml(node.id)}"
            >
              <span>${escapeHtml(nodeLabel(node))}</span>
              <small>${escapeHtml(node.type)}</small>
            </button>
          </li>
        `).join("")}
      </ol>
    `;
  }

  function connectionAccordion(entry)
  {
    const { node, path } = entry;

    return `
      <details class="panel-connection-item">
        <summary data-node-id="${escapeHtml(node.id)}">
          <span>${escapeHtml(nodeLabel(node))}</span>
          ${itemDetail(node) ? `<small>${escapeHtml(itemDetail(node))}</small>` : ""}
        </summary>
        ${pathHtml(path)}
      </details>
    `;
  }

  function connectionsTabHtml()
  {
    const groups = connectionGroups();
    const labels = {
      artist: "Artists",
      album: "Albums",
      track: "Tracks"
    };

    return `
      ${tabHtml()}
      <div class="panel-connections">
        ${Object.entries(groups).map(([type, nodes]) => `
          <details class="panel-accordion" open>
            <summary>${labels[type]} <span>${nodes.length}</span></summary>
            ${
              nodes.length
                ? nodes.map(connectionAccordion).join("")
                : `<div class="panel-empty">No visible ${labels[type].toLowerCase()}.</div>`
            }
          </details>
        `).join("")}
      </div>
    `;
  }

  function renderBody()
  {
    if (!selectedDetails) return;

    body.innerHTML =
      activeTab === "connections"
        ? connectionsTabHtml()
        : focusTabHtml(selectedDetails);

    bindArtworkFallback(body);
  }

  function render(details)
  {
    const { node } = details;
    selectedNodeId = node.id;
    selectedDetails = details;
    panel.hidden = false;
    renderBody();
  }

  async function open(node, options = {})
  {
    if (!node?.id) return;

    const shouldRemember =
      options.remember !== false;

    const currentRun = ++runId;
    selectedNodeId = node.id;
    activeTab = "focus";
    if (shouldRemember) remember(node);
    else updateNavButtons();
    loading(node);

    try
    {
      const details = await loadDetails(node);

      if (currentRun !== runId) return;
      render(details);
    }
    catch (err)
    {
      if (currentRun !== runId) return;
      setStatus?.(err.message);
      body.innerHTML = `<div class="panel-empty">${escapeHtml(err.message)}</div>`;
    }
  }

  backButton.addEventListener("click", () =>
  {
    if (historyIndex <= 0) return;
    historyIndex--;
    updateNavButtons();
    onHistoryNavigate?.(history[historyIndex]);
  });

  forwardButton.addEventListener("click", () =>
  {
    if (historyIndex >= history.length - 1) return;
    historyIndex++;
    updateNavButtons();
    onHistoryNavigate?.(history[historyIndex]);
  });

  connectionsButton.addEventListener("click", async () =>
  {
    if (!selectedNodeId) return;

    connectionsButton.disabled = true;
    connectionsButton.textContent = "Finding...";

    try
    {
      await onShowArtistConnections?.();
    }
    finally
    {
      connectionsButton.disabled = false;
      connectionsButton.textContent = "Show Artist Connections";

      if (activeTab === "connections")
      {
        renderBody();
      }
    }
  });

  body.addEventListener("click", (event) =>
  {
    const tab = event.target.closest(".panel-tab");
    if (tab)
    {
      activeTab = tab.dataset.tab || "focus";
      renderBody();
      return;
    }

    const button =
      event.target.closest(".panel-list-item, .panel-meta-node");
    if (button)
    {
      const item = currentItems.get(button.dataset.nodeId);
      onItemClick?.(item, item?.parentNode || selectedDetails?.node, item);
      return;
    }

    const connectionButton = event.target.closest(".panel-path-node");
    if (connectionButton)
    {
      const entry =
        (getConnections?.() || [])
          .find((item) => (item.node || item).id === connectionButton.dataset.nodeId);
      const node =
        entry?.node ||
        (getConnections?.() || [])
          .flatMap((item) => item.path || [])
          .find((item) => item.id === connectionButton.dataset.nodeId);

      activeTab = "focus";
      onConnectionClick?.(node, { path: entry?.path || [node].filter(Boolean) });
    }
  });

  updateNavButtons();

  return {
    close,
    hide,
    show,
    toggle,
    isVisible()
    {
      return !panel.hidden;
    },
    open,
    openFromHistory(node)
    {
      return open(node, { remember: false });
    },
    getSelectedNodeId()
    {
      return selectedNodeId;
    }
  };
}
