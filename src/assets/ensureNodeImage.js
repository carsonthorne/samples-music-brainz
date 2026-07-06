const fs = require("fs");
const {
  diskPathFor,
  ensureAssetDirs,
  existingAsset,
  isMarkedMissing,
  markMissing,
  webPathFor
} = require("./assetPaths");
const { isValidImage, writeWebp } = require("./imageTools");

const inflight = new Map();

async function fetchBuffer(url)
{
  const response = await fetch(url, {
    headers: {
      "User-Agent": "samples-music-brainz/1.0 (local on-demand artwork cache)"
    }
  });

  if (!response.ok) return null;

  return Buffer.from(await response.arrayBuffer());
}

async function fetchAlbumArtwork(mbid)
{
  return fetchBuffer(
    `https://coverartarchive.org/release-group/${mbid}/front-250`
  );
}

async function fetchArtistAvatar(mbid)
{
  const response =
    await fetch(`https://www.theaudiodb.com/api/v1/json/123/artist-mb.php?i=${mbid}`);

  if (!response.ok) return null;

  const data = await response.json();
  const imageUrl = data?.artists?.[0]?.strArtistThumb;

  if (!imageUrl) return null;

  return fetchBuffer(imageUrl);
}

async function downloadAndCache(type, mbid)
{
  const buffer =
    type === "album"
      ? await fetchAlbumArtwork(mbid)
      : await fetchArtistAvatar(mbid);

  if (!buffer)
  {
    markMissing(type, mbid);
    return null;
  }

  await writeWebp(buffer, diskPathFor(type, mbid, "webp"));

  return {
    filePath: diskPathFor(type, mbid, "webp"),
    webPath: webPathFor(type, mbid, "webp"),
    extension: "webp"
  };
}

async function ensureNodeImage(type, mbid)
{
  if (!["album", "artist"].includes(type) || !mbid)
  {
    return null;
  }

  ensureAssetDirs();

  const cached = existingAsset(type, mbid);
  if (cached)
  {
    if (await isValidImage(cached.filePath))
    {
      return cached;
    }

    fs.unlinkSync(cached.filePath);
  }

  if (isMarkedMissing(type, mbid)) return null;

  const key = `${type}:${mbid}`;

  if (!inflight.has(key))
  {
    inflight.set(
      key,
      downloadAndCache(type, mbid)
        .finally(() => inflight.delete(key))
    );
  }

  return inflight.get(key);
}

module.exports = {
  ensureNodeImage
};
