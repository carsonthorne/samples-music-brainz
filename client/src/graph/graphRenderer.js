import ForceGraph3D from "3d-force-graph";
import { forceCollide } from "d3-force-3d";
import ForceGraph2D from "force-graph";
import * as THREE from "three";

const textureCache = new Map();
const textureLoader = new THREE.TextureLoader();
const canvasImageCache = new Map();

const RECORD_PLACEHOLDER = 'data:image/svg+xml;utf8,<svg fill="white" height="200px" width="200px" version="1.1" id="Capa_1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 191.076 191.076" xml:space="preserve"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"> <path d="M95.538,191.076C42.858,191.076,0,148.218,0,95.538S42.858,0,95.538,0s95.538,42.858,95.538,42.858 S148.218,191.076,95.538,191.076z M95.538,4C45.064,4,4,45.064,4,95.538s41.064,91.538,91.538,91.538 c50.475,0,91.538-41.064,91.538-91.538S146.013,4,95.538,4z M95.538,181.743c-47.533,0-86.205-38.671-86.205-86.205 c0-47.534,38.671-86.205,86.205-86.205s86.205,38.671,86.205,86.205C181.743,143.071,143.071,181.743,95.538,181.743z M95.538,13.333c-45.328,0-82.205,36.877-82.205,82.205c0,45.328,36.877,82.205,82.205,82.205c45.328,0,82.205-36.877,82.205-82.205 C177.743,50.21,140.866,13.333,95.538,13.333z M95.538,172.743c-42.571,0-77.205-34.634-77.205-77.205s34.634-77.205,77.205-77.205 c1.104,0,2,0.896,2,2s-0.896,2-2,2c-40.365,0-73.205,32.84-73.205,73.205s32.839,73.205,73.205,73.205c1.104,0,2,0.896,2,2 S96.643,172.743,95.538,172.743z M95.538,153.384c-31.896,0-57.846-25.95-57.846-57.846c0-31.896,25.95-57.846,57.846-57.846 c1.104,0,2,0.896,2,2s-0.896,2-2,2c-29.69,0-53.846,24.155-53.846,53.846c0,29.69,24.155,53.846,53.846,53.846c1.104,0,2,0.896,2,2 S96.643,153.384,95.538,153.384z M95.538,138.076C72.083,138.076,53,118.994,53,95.538S72.083,53,95.538,53 c23.456,0,42.538,19.083,42.538,42.538S118.994,138.076,95.538,138.076z M95.538,57C74.288,57,57,74.288,57,95.538 s17.288,38.538,38.538,38.538s38.538-17.288,38.538-38.538S116.788,57,95.538,57z M95.538,102.409c-3.789,0-6.872-3.083-6.872-6.871 c0-3.789,3.083-6.872,6.872-6.872s6.871,3.083,6.871,6.872C102.409,99.327,99.327,102.409,95.538,102.409z M95.538,92.667 c-1.583,0-2.872,1.288-2.872,2.872c0,1.583,1.288,2.871,2.872,2.871c1.583,0,2.871-1.288,2.871-2.871 C98.409,93.955,97.121,92.667,95.538,92.667z"></path> </g></svg>';
const ARTIST_PLACEHOLDER = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 24 24" fill="none" stroke="%23ffffff" stroke-width="1.5"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 4-7 8-7s8 3 8 7"/></svg>';
const FOCUSED_RECORD_PLACEHOLDER = RECORD_PLACEHOLDER.replace('fill="white"', 'fill="%23f59e0b"');
const FOCUSED_ARTIST_PLACEHOLDER = ARTIST_PLACEHOLDER.replace("stroke=\"%23ffffff\"", "stroke=\"%23f59e0b\"");
const DAG_MODE = "td";
const THREE_D_DAG_DISTANCE = 160;
const TWO_D_DAG_DISTANCE = 90;
const TWO_D_LINK_DISTANCE = 75;

function cachedTexture(cacheKey, imageSrc)
{
  if (!textureCache.has(cacheKey)) {
    const texture = textureLoader.load(imageSrc);
    texture.colorSpace = THREE.SRGBColorSpace;
    textureCache.set(cacheKey, texture);
  }

  return textureCache.get(cacheKey);
}

function createImageSprite(node, imageSrc, fallbackSrc, cacheKey)
{
  const fallbackTexture =
    cachedTexture(`fallback:${cacheKey}`, fallbackSrc);

  const material =
    new THREE.SpriteMaterial({
      map: textureCache.get(cacheKey) || fallbackTexture,
      transparent: true
    });

  // Cache textures, not Sprite objects. ForceGraph owns the lifecycle of the
  // returned THREE object, so each redraw needs a fresh attachable Sprite.
  if (imageSrc && !textureCache.has(cacheKey)) {
    textureLoader.load(
      imageSrc,
      (texture) => {
        texture.colorSpace = THREE.SRGBColorSpace;
        textureCache.set(cacheKey, texture);
        material.map = texture;
        material.needsUpdate = true;
      },
      undefined,
      () => {
        material.map = fallbackTexture;
        material.needsUpdate = true;
      }
    );
  }

  return new THREE.Sprite(material);
}

function nodeImageSource(node, state)
{
  const focused = node.id === state.focusNode;
  if (node.type === "album") return focused ? FOCUSED_RECORD_PLACEHOLDER : RECORD_PLACEHOLDER;
  if (node.type === "artist") return focused ? FOCUSED_ARTIST_PLACEHOLDER : ARTIST_PLACEHOLDER;
  return null;
}

function getCanvasImage(src)
{
  if (!src) return null;

  if (!canvasImageCache.has(src))
  {
    const image = new Image();
    image.src = src;
    canvasImageCache.set(src, image);
  }

  return canvasImageCache.get(src);
}

function nodeRadius(node, state)
{
  if (node.type === "track") return node.id === state.focusNode ? 7 : 5;
  return node.id === state.focusNode ? 16 : 12;
}

function collisionRadius(node, state)
{
  return nodeRadius(node, state) + (node.type === "track" ? 9 : 16);
}

function drawCircularImage(ctx, image, x, y, radius)
{
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, 2 * Math.PI, false);
  ctx.clip();
  ctx.drawImage(image, x - radius, y - radius, radius * 2, radius * 2);
  ctx.restore();
}

function drawCanvasNode(state)
{
  return (node, ctx) =>
  {
    const radius = nodeRadius(node, state);
    const image =
      getCanvasImage(nodeImageSource(node, state));

    ctx.save();

    if (image?.complete && image.naturalWidth > 0)
    {
      drawCircularImage(ctx, image, node.x, node.y, radius);
    }
    else
    {
      ctx.beginPath();
      ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI, false);
      ctx.fillStyle = node.id === state.focusNode ? "#f59e0b" : "#ffffff";
      ctx.fill();
    }

    ctx.restore();
  };
}

function paintPointerArea(state)
{
  return (node, color, ctx) =>
  {
    const radius = nodeRadius(node, state) + 4;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI, false);
    ctx.fill();
  };
}

function hasMethod(object, name)
{
  return typeof object?.[name] === "function";
}

export function createGraph(container, state, graph, onNodeClick)
{
  let graphData = graph;
  let viewMode = "3d";
  let dagEnabled = false;
  let instance = null;
  let orbitFrame = null;
  let orbitAngle = 0;
  let orbitRadius = 520;
  let orbitHeight = 115;

  function emitOrbitChange()
  {
    container.dispatchEvent(
      new CustomEvent("samplegraph:orbitchange", {
        detail: { orbiting: Boolean(orbitFrame) }
      })
    );
  }

  function stopAutoOrbit()
  {
    if (orbitFrame)
    {
      cancelAnimationFrame(orbitFrame);
      orbitFrame = null;
      emitOrbitChange();
    }
  }

  function handleNodeClick(node)
  {
    stopAutoOrbit();
    onNodeClick(node);
  }

  function applyDagSettings()
  {
    if (!instance) return;

    instance
      .dagMode(dagEnabled ? DAG_MODE : null)
      .dagLevelDistance(
        viewMode === "3d" ? THREE_D_DAG_DISTANCE : TWO_D_DAG_DISTANCE
      );

    if (hasMethod(instance, "d3ReheatSimulation"))
    {
      instance.d3ReheatSimulation();
    }
  }

  function threeNodeObject(node)
  {
    if (node.type === "album")
    {
      const focused = node.id === state.focusNode;
      const sprite = createImageSprite(
        node,
        null,
        nodeImageSource(node, state),
        `album:${node.id}:placeholder:${focused ? "focused" : "default"}`
      );
      const size = focused ? 18 : 12;
      sprite.scale.set(size, size, 1);
      return sprite;
    }

    if (node.type === "artist")
    {
      const focused = node.id === state.focusNode;
      const sprite = createImageSprite(
        node,
        null,
        nodeImageSource(node, state),
        `artist:${node.id}:placeholder:${focused ? "focused" : "default"}`
      );
      const size = focused ? 18 : 12;
      sprite.scale.set(size, size, 1);
      return sprite;
    }

    // Tracks use the default 3d-force-graph sphere.
    return null;
  }

  function create3dGraph()
  {
    return ForceGraph3D({ controlType: "orbit" })(container)
      .graphData(graphData)
      .nodeLabel(node => `${node.type}: ${node.name}`)
      .nodeAutoColorBy("type")
      .linkDirectionalParticles(2)
      .linkDirectionalParticleSpeed(0.005)
      .onNodeClick(handleNodeClick)
      .nodeColor(node =>
      {
        if (node.id === state.focusNode) return "orange";
        return "white";
      })
      .nodeThreeObject(threeNodeObject);
  }

  function configure3dControls()
  {
    if (viewMode !== "3d" || !instance) return;

    const controls = instance.controls?.();
    if (!controls) return;

    // Three's OrbitControls can dolly toward the pointer instead of always
    // using the center of the canvas, which makes dense graph navigation gentler.
    if ("zoomToCursor" in controls)
    {
      controls.zoomToCursor = true;
      controls.update?.();
    }
  }

  function bind3dControlEvents()
  {
    if (container.__sampleGraphPointerBound) return;

    // Wheel/trackpad zoom should keep auto-orbit running. Pointer drags still
    // mean the user is taking direct control of the camera.
    container.addEventListener("pointerdown", () =>
    {
      if (viewMode === "3d")
      {
        stopAutoOrbit();
      }
    });
    container.__sampleGraphPointerBound = true;
  }

  function create2dGraph()
  {
    const graph = ForceGraph2D()(container)
      .graphData(graphData)
      .nodeLabel(node => `${node.type}: ${node.name}`)
      .nodeVal(node => node.type === "track" ? 24 : 96)
      .linkColor(() => "rgba(226, 232, 240, 0.58)")
      .linkWidth(1.35)
      .linkDirectionalParticleColor(() => "rgba(251, 191, 36, 0.82)")
      .linkDirectionalParticles(2)
      .linkDirectionalParticleSpeed(0.005)
      .onNodeClick(handleNodeClick)
      .nodeCanvasObject(drawCanvasNode(state))
      .nodePointerAreaPaint(paintPointerArea(state))
      .nodeColor(node =>
      {
        if (node.id === state.focusNode) return "orange";
        return "white";
      });

    graph.d3Force("charge")?.strength(-210);
    graph.d3Force("link")?.distance(TWO_D_LINK_DISTANCE).strength(0.65);
    graph.d3Force(
      "collide",
      forceCollide(node => collisionRadius(node, state))
        .strength(1)
        .iterations(4)
    );

    return graph;
  }

  function rebuildGraph()
  {
    if (hasMethod(instance, "_destructor"))
    {
      instance._destructor();
    }

    container.innerHTML = "";
    instance = viewMode === "3d" ? create3dGraph() : create2dGraph();
    applyDagSettings();
    configure3dControls();
    bind3dControlEvents();
    requestAnimationFrame(() =>
    {
      configure3dControls();
      bind3dControlEvents();
    });
  }

  function focus2dNode(node, duration)
  {
    const x = Number(node.x);
    const y = Number(node.y);

    if (!Number.isFinite(x) || !Number.isFinite(y)) return;

    instance.centerAt(x, y, duration);
    instance.zoom(3.2, duration);
  }

  function fitToCanvas(duration = 900)
  {
    if (!instance || !hasMethod(instance, "zoomToFit")) return controller;

    instance.zoomToFit(duration, 60);
    return controller;
  }

  function startAutoOrbit()
  {
    stopAutoOrbit();

    if (viewMode !== "3d" || !instance || !hasMethod(instance, "cameraPosition"))
    {
      return controller;
    }

    const camera = instance.camera?.();
    const controls = instance.controls?.();
    const target = controls?.target || { x: 0, y: 0, z: 0 };
    const position = camera?.position;
    const startingRadius =
      position ? Math.hypot(position.x - target.x, position.z - target.z) : orbitRadius;

    if (Number.isFinite(startingRadius) && startingRadius > 40)
    {
      orbitRadius = startingRadius;
    }

    if (Number.isFinite(position?.y))
    {
      orbitHeight = position.y - target.y;
    }

    function tick()
    {
      const liveControls = instance.controls?.();
      const liveTarget = liveControls?.target || { x: 0, y: 0, z: 0 };
      const livePosition = instance.camera?.()?.position;
      const liveRadius =
        livePosition
          ? Math.hypot(livePosition.x - liveTarget.x, livePosition.z - liveTarget.z)
          : orbitRadius;

      if (Number.isFinite(liveRadius) && liveRadius > 40)
      {
        orbitRadius = liveRadius;
      }

      if (Number.isFinite(livePosition?.y))
      {
        orbitHeight = livePosition.y - liveTarget.y;
      }

      orbitAngle += 0.004;

      instance.cameraPosition(
        {
          x: liveTarget.x + orbitRadius * Math.sin(orbitAngle),
          y: liveTarget.y + orbitHeight,
          z: liveTarget.z + orbitRadius * Math.cos(orbitAngle)
        },
        { x: liveTarget.x, y: liveTarget.y, z: liveTarget.z },
        0
      );

      orbitFrame = requestAnimationFrame(tick);
    }

    orbitFrame = requestAnimationFrame(tick);
    emitOrbitChange();
    return controller;
  }

  const controller = {
    graphData(data)
    {
      if (arguments.length === 0)
      {
        return instance?.graphData() || graphData;
      }

      graphData = data;
      instance?.graphData(data);
      if (viewMode === "3d")
      {
        instance?.nodeThreeObject(threeNodeObject);
      }
      return controller;
    },

    cameraPosition(position, node, duration)
    {
      if (viewMode === "3d" && hasMethod(instance, "cameraPosition"))
      {
        stopAutoOrbit();
        instance.cameraPosition(position, node, duration);
      }
      else if (viewMode === "2d")
      {
        focus2dNode(node, duration);
      }

      return controller;
    },

    setViewMode(nextMode)
    {
      if (nextMode === viewMode) return controller;

      stopAutoOrbit();
      viewMode = nextMode;
      rebuildGraph();
      return controller;
    },

    getViewMode()
    {
      return viewMode;
    },

    setDagEnabled(enabled)
    {
      dagEnabled = enabled;
      applyDagSettings();
      return controller;
    },

    getDagEnabled()
    {
      return dagEnabled;
    },

    fitToCanvas,

    startAutoOrbit,

    isAutoOrbiting()
    {
      return Boolean(orbitFrame);
    },

    stopAutoOrbit()
    {
      stopAutoOrbit();
      return controller;
    }
  };

  rebuildGraph();

  return controller;
}
