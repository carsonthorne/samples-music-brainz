const { streamTar } = require("./streamTar");

const DUMP_PATH =
  process.env.MUSICBRAINZ_DUMP || "musicbrainz-dump/mbdump.tar.bz2";

async function inspectSampleLinkTypes() {
  console.log("Inspecting link_type rows containing 'sample'...");
  console.log("Dump:", DUMP_PATH);

  const rl = streamTar(DUMP_PATH, "mbdump/link_type");
  let matched = 0;
  let scanned = 0;

  for await (const line of rl) {
    if (!line.trim()) continue;

    scanned++;

    if (!line.toLowerCase().includes("sample")) {
      continue;
    }

    matched++;

    const cols = line.split("\t");

    console.log("\nMATCH", matched);
    console.log("raw:", line);

    for (let i = 0; i < cols.length; i++) {
      console.log(`${i}: ${cols[i]}`);
    }
  }

  console.log("\nDONE inspectSampleLinkTypes");
  console.log("Rows scanned:", scanned.toLocaleString());
  console.log("Rows matched:", matched.toLocaleString());
}

inspectSampleLinkTypes().catch((error) => {
  console.error(error);
  process.exit(1);
});
