const fs = require("fs");
const path = require("path");
const {
  ARTWORK_DIR,
  AVATAR_DIR,
  ensureAssetDirs
} = require("./assetPaths");
const { convertFileToWebp } = require("./imageTools");

function parseArgs(argv)
{
  return {
    deleteOriginals: argv.includes("--delete-originals"),
    dryRun: argv.includes("--dry-run"),
    help: argv.includes("--help") || argv.includes("-h")
  };
}

function usage()
{
  console.log(`
Convert existing public JPG/JPEG album and artist images to WebP.

Usage:
  npm run assets:convert:webp
  npm run assets:convert:webp -- --dry-run
  npm run assets:convert:webp -- --delete-originals

Options:
  --dry-run           Print what would be converted without writing files.
  --delete-originals  Remove JPG/JPEG files after successful WebP conversion.
`);
}

function findJpegs(dir)
{
  if (!fs.existsSync(dir)) return [];

  return fs.readdirSync(dir)
    .filter(file => /\.(jpe?g)$/i.test(file))
    .map(file => path.join(dir, file));
}

async function convertDir(label, dir, options)
{
  const files = findJpegs(dir);
  let converted = 0;
  let skipped = 0;

  for (const filePath of files)
  {
    const targetPath =
      filePath.replace(/\.(jpe?g)$/i, ".webp");

    if (fs.existsSync(targetPath))
    {
      skipped++;
      continue;
    }

    if (options.dryRun)
    {
      console.log(`[dry-run] ${label}: ${path.basename(filePath)} -> ${path.basename(targetPath)}`);
      converted++;
      continue;
    }

    await convertFileToWebp(filePath, targetPath);

    if (options.deleteOriginals)
    {
      fs.unlinkSync(filePath);
    }

    converted++;
    console.log(`[converted] ${label}: ${path.basename(targetPath)}`);
  }

  return { converted, skipped };
}

async function main()
{
  const options = parseArgs(process.argv.slice(2));

  if (options.help)
  {
    usage();
    return;
  }

  ensureAssetDirs();

  const artwork = await convertDir("artwork", ARTWORK_DIR, options);
  const avatars = await convertDir("avatars", AVATAR_DIR, options);

  console.log("WebP conversion complete:", {
    artwork,
    avatars,
    deleteOriginals: options.deleteOriginals,
    dryRun: options.dryRun
  });
}

main().catch((error) =>
{
  console.error(error.message);
  process.exitCode = 1;
});
