const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const PROJECT_ROOT = path.resolve(__dirname, "../..");
const DEFAULT_DUMP_PATH = path.join(PROJECT_ROOT, "musicbrainz-dump/mbdump.tar.bz2");
const DEFAULT_BUILD_DB = path.join(PROJECT_ROOT, "data/sample-graph-build.sqlite");
const DEFAULT_RUNTIME_DB = path.join(PROJECT_ROOT, "data/sample-graph-runtime.sqlite");
const DEFAULT_NEXT_RUNTIME_DB = path.join(PROJECT_ROOT, "data/sample-graph-runtime-next.sqlite");

const dumpPath = path.resolve(process.argv[2] || process.env.MUSICBRAINZ_DUMP || DEFAULT_DUMP_PATH);
const buildDbPath = path.resolve(process.env.BUILD_DB || DEFAULT_BUILD_DB);
const runtimeDbPath = path.resolve(process.env.RUNTIME_DB || DEFAULT_RUNTIME_DB);
const nextRuntimeDbPath = path.resolve(process.env.NEXT_RUNTIME_DB || DEFAULT_NEXT_RUNTIME_DB);
const backupRuntimeDbPath = `${runtimeDbPath}.backup`;

const steps = [
  ["Initialize build database", "db:init"],
  ["Load recordings", "compile:recordings"],
  ["Load artists", "compile:artists"],
  ["Load albums", "compile:albums"],
  ["Load artist credits", "compile:artist-credits"],
  ["Derive artist albums", "derive:artist-albums"],
  ["Load mediums", "compile:mediums"],
  ["Load releases", "compile:releases"],
  ["Load MusicBrainz tracks", "compile:mb-tracks"],
  ["Derive album tracks", "derive:album-tracks"],
  ["Load sample links", "compile:sample-links"],
  ["Load sample edges", "compile:sample-edges"],
  ["Derive track samples", "derive:track-samples"],
];

function removeIfExists(filePath) {
  if (fs.existsSync(filePath)) {
    fs.rmSync(filePath, { recursive: true, force: true });
  }
}

function removeEmptyParentDir(filePath) {
  const parent = path.dirname(filePath);

  try {
    fs.rmdirSync(parent);
  }
  catch (error) {
    if (error.code !== "ENOTEMPTY" && error.code !== "ENOENT") {
      throw error;
    }
  }
}

function runNpmScript(label, scriptName, env) {
  console.log(`\n==> ${label}`);

  const result = spawnSync("npm", ["run", scriptName], {
    cwd: PROJECT_ROOT,
    env,
    stdio: "inherit",
  });

  if (result.status !== 0) {
    throw new Error(`${label} failed with exit code ${result.status}`);
  }
}

function swapRuntimeDb() {
  removeIfExists(backupRuntimeDbPath);

  if (fs.existsSync(runtimeDbPath)) {
    fs.renameSync(runtimeDbPath, backupRuntimeDbPath);
  }

  try {
    fs.renameSync(nextRuntimeDbPath, runtimeDbPath);
    removeIfExists(backupRuntimeDbPath);
  }
  catch (error) {
    if (fs.existsSync(backupRuntimeDbPath) && !fs.existsSync(runtimeDbPath)) {
      fs.renameSync(backupRuntimeDbPath, runtimeDbPath);
    }

    throw error;
  }
}

if (!fs.existsSync(dumpPath)) {
  throw new Error(`MusicBrainz dump not found: ${dumpPath}`);
}

fs.mkdirSync(path.dirname(buildDbPath), { recursive: true });
fs.mkdirSync(path.dirname(runtimeDbPath), { recursive: true });

removeIfExists(buildDbPath);
removeIfExists(nextRuntimeDbPath);

const env = {
  ...process.env,
  MUSICBRAINZ_DUMP: dumpPath,
  SAMPLE_GRAPH_DB: buildDbPath,
  SAMPLE_GRAPH_DB_MODE: "build",
};

console.log("Rebuilding full database from dump");
console.log("Dump:", dumpPath);
console.log("Build DB:", buildDbPath);
console.log("Runtime DB:", runtimeDbPath);

try {
  for (const [label, scriptName] of steps) {
    runNpmScript(label, scriptName, env);
  }

  console.log("\n==> Create runtime full-search database");

  const runtimeResult = spawnSync(
    "node",
    ["src/db/createRuntimeDb.js", buildDbPath, nextRuntimeDbPath],
    {
      cwd: PROJECT_ROOT,
      env: process.env,
      stdio: "inherit",
    }
  );

  if (runtimeResult.status !== 0) {
    throw new Error(`Runtime DB creation failed with exit code ${runtimeResult.status}`);
  }

  swapRuntimeDb();

  console.log("\n==> Delete build artifacts");
  removeIfExists(buildDbPath);
  removeIfExists(dumpPath);
  removeEmptyParentDir(dumpPath);

  console.log("\nDone.");
  console.log("Runtime DB:", runtimeDbPath);
  console.log("Deleted full build DB:", buildDbPath);
  console.log("Deleted dump:", dumpPath);
}
catch (error) {
  console.error("\nRebuild failed.");
  console.error(error.message);
  console.error("Keeping any existing runtime DB in place.");
  process.exitCode = 1;
}
