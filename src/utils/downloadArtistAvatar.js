// src/utils/downloadArtistAvatar.js
const fs = require("fs");
const path = require("path");

async function downloadArtistAvatar(artistMbid) {
  const targetDir = path.join(__dirname, "../../graph-frontend/public/avatars");
  const targetPath = path.join(targetDir, `${artistMbid}.jpg`);

  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  if (fs.existsSync(targetPath)) {
    return `/avatars/${artistMbid}.jpg`;
  }

  const url = `https://www.theaudiodb.com/api/v1/json/123/artist-mb.php?i=${artistMbid}`;

  try {
    console.log(`[AVATAR DETECTED] Looking up images for MBID: ${artistMbid}`);
    const res = await fetch(url);
    
    if (res.status === 429) {
      console.warn(`[AVATAR WARN] Rate limit exceeded on TheAudioDB! Defaulting to placeholder.`);
      return null;
    }

    if (!res.ok) {
      console.error(`[AVATAR ERROR] API responded with HTTP status ${res.status} for ${artistMbid}`);
      return null;
    }

    const data = await res.json();
    
    if (!data || !data.artists) {
      console.log(`[AVATAR Missing] TheAudioDB has no record matching MBID: ${artistMbid}`);
      return null;
    }
    
    const imgUrl = data.artists[0].strArtistThumb;
    if (!imgUrl) {
      console.log(`[AVATAR Missing] Artist entry found, but "strArtistThumb" is empty for: ${data.artists[0].strArtist}`);
      return null;
    }
    
    const imgRes = await fetch(imgUrl);
    if (!imgRes.ok) return null;

    const buffer = Buffer.from(await imgRes.arrayBuffer());
    fs.writeFileSync(targetPath, buffer);
    console.log(`[AVATAR SUCCESS] Saved profile image: avatars/${artistMbid}.jpg`);
    
    await new Promise((resolve) => setTimeout(resolve, 1500));
    return `/avatars/${artistMbid}.jpg`;
  } catch (err) {
    console.error(`[AVATAR ERROR] Parsing or network failure for ${artistMbid}:`, err.message);
    return null;
  }
}

module.exports = downloadArtistAvatar;