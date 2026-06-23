import ForceGraph3D from "3d-force-graph";
import * as THREE from "three";

// Cache systems to prevent layout stutters during WebGL canvas ticks
const textureCache = new Map();
const spriteCache = new Map();
const textureLoader = new THREE.TextureLoader();

export function createGraph(container, state, graph, onNodeClick)
{
  const g = ForceGraph3D()(container)
    .graphData(graph)
    .nodeLabel(node => `${node.type}: ${node.name}`)
    .nodeAutoColorBy('type')
    .linkDirectionalParticles(2)
    .linkDirectionalParticleSpeed(0.005)
    .onNodeClick(onNodeClick)
    .nodeColor(node =>
    {
      if (node.id === state.focusNode) return "orange";
      if (state.expanded.has(node.id) && state.graph.adjacency[node.id]?.length) return "lightgreen";
      if (state.graph.adjacency[node.id]?.length) return "gold";
      return "steelblue";
    })
    .nodeThreeObject(node => {
      // Handle Album Nodes with local static pathing strings
      if (node.type === 'album' && node.artwork) {
        
        // Match 1: Return compiled 3D wrapper instance immediately if active
        if (spriteCache.has(node.id)) {
          const cachedSprite = spriteCache.get(node.id);
          cachedSprite.scale.set(node.id === state.focusNode ? 18 : 12, node.id === state.focusNode ? 18 : 12, 1);
          return cachedSprite;
        }

        // Match 2: If texture raw map exists, build the sprite mesh element instantly
        if (textureCache.has(node.id)) {
          const material = new THREE.SpriteMaterial({ map: textureCache.get(node.id), transparent: true });
          const sprite = new THREE.Sprite(material);
          sprite.scale.set(node.id === state.focusNode ? 18 : 12, node.id === state.focusNode ? 18 : 12, 1);
          spriteCache.set(node.id, sprite);
          return sprite;
        }

        // Match 3: Fresh texture initialization from local project bundle path
        const texture = textureLoader.load(node.artwork);
        texture.colorSpace = THREE.SRGBColorSpace;
        textureCache.set(node.id, texture);

        const material = new THREE.SpriteMaterial({ map: texture, transparent: true });
        const sprite = new THREE.Sprite(material);
        sprite.scale.set(node.id === state.focusNode ? 18 : 12, node.id === state.focusNode ? 18 : 12, 1);
        
        spriteCache.set(node.id, sprite);
        return sprite;
      }
      
      // Track and Artist nodes naturally fallback to standard colored interactive spheres
      return null;
    });

  return g;
}