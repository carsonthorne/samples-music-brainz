const fs = require("fs");
const path = require("path");

const PUBLIC_DIR = path.resolve(__dirname, "../../client/public");
const ARTWORK_DIR = path.join(PUBLIC_DIR, "artwork");
const AVATAR_DIR = path.join(PUBLIC_DIR, "avatars");

function ensureAssetDirs()
{
  fs.mkdirSync(ARTWORK_DIR, { recursive: true });
  fs.mkdirSync(AVATAR_DIR, { recursive: true });
}

function assetDirFor(type)
{
  if (type === "album") return ARTWORK_DIR;
  if (type === "artist") return AVATAR_DIR;
  throw new Error(`Unknown asset type: ${type}`);
}

function webPathFor(type, mbid, extension = "webp")
{
  const folder = type === "album" ? "artwork" : "avatars";
  return `/${folder}/${mbid}.${extension}`;
}

function diskPathFor(type, mbid, extension = "webp")
{
  return path.join(assetDirFor(type), `${mbid}.${extension}`);
}

function missingPathFor(type, mbid)
{
  return diskPathFor(type, mbid, "missing");
}

function isMarkedMissing(type, mbid)
{
  return fs.existsSync(missingPathFor(type, mbid));
}

function markMissing(type, mbid)
{
  fs.writeFileSync(missingPathFor(type, mbid), new Date().toISOString());
}

function existingAsset(type, mbid)
{
  for (const extension of ["webp", "jpg", "jpeg", "png"])
  {
    const filePath = diskPathFor(type, mbid, extension);
    if (fs.existsSync(filePath))
    {
      return {
        filePath,
        webPath: webPathFor(type, mbid, extension),
        extension
      };
    }
  }

  return null;
}

module.exports = {
  PUBLIC_DIR,
  ARTWORK_DIR,
  AVATAR_DIR,
  ensureAssetDirs,
  assetDirFor,
  webPathFor,
  diskPathFor,
  missingPathFor,
  isMarkedMissing,
  markMissing,
  existingAsset
};
