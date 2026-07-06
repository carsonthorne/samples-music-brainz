const fs = require("fs");

let sharp;

function getSharp()
{
  if (!sharp)
  {
    try
    {
      sharp = require("sharp");
    }
    catch
    {
      throw new Error(
        "The asset scripts need the sharp package. Run npm install before fetching or converting images."
      );
    }
  }

  return sharp;
}

async function writeWebp(buffer, targetPath)
{
  const tempPath = `${targetPath}.tmp`;

  await getSharp()(buffer)
    .rotate()
    .resize({
      width: 320,
      height: 320,
      fit: "cover",
      withoutEnlargement: true
    })
    .webp({ quality: 82 })
    .toFile(tempPath);

  fs.renameSync(tempPath, targetPath);
}

async function convertFileToWebp(sourcePath, targetPath)
{
  await writeWebp(fs.readFileSync(sourcePath), targetPath);
}

async function isValidImage(filePath)
{
  try
  {
    const metadata = await getSharp()(filePath).metadata();
    return Boolean(metadata.width && metadata.height);
  }
  catch
  {
    return false;
  }
}

module.exports = {
  writeWebp,
  convertFileToWebp,
  isValidImage
};
