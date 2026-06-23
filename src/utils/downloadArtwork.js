// src/utils/downloadArtwork.js
const fs = require("fs");
const path = require("path");

/**
 * Downloads a 250px cover thumbnail from Cover Art Archive to the static public folder.
 * @param {string} releaseGroupId - The MusicBrainz Release Group MBID
 * @returns {Promise<string|null>} Relative web asset path if successful, or null
 */
async function downloadArtwork(releaseGroupId) {
  // Target the static public folder inside your frontend workspace
  const targetDir = path.join(__dirname, "../../graph-frontend/public/artwork");
  const targetPath = path.join(targetDir, `${releaseGroupId}.jpg`);

  // 1. Ensure the target subdirectory directory structures exist
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  // 2. Optimization: If the asset is already stored locally, bypass download completely
  if (fs.existsSync(targetPath)) {
    return `/artwork/${releaseGroupId}.jpg`;
  }

  const url = `https://coverartarchive.org/release-group/${releaseGroupId}/front-250`;

  try {
    const response = await fetch(url);
    
    if (!response.ok) {
      // Handles cases where an album has no cover art assigned on MusicBrainz
      return null;
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    fs.writeFileSync(targetPath, buffer);
    console.log(`[ASSET DOWNLOADED] Saved local file: artwork/${releaseGroupId}.jpg`);

    // Polite delay rate limiter to respect community server rules
    await new Promise((resolve) => setTimeout(resolve, 1000));

    return `/artwork/${releaseGroupId}.jpg`;
  } catch (error) {
    console.error(`[DOWNLOAD FAILED] Error for release group ${releaseGroupId}:`, error.message);
    return null;
  }
}

module.exports = downloadArtwork;