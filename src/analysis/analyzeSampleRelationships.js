const { execSync } = require("child_process");

const DUMP = "musicbrainz-dump/mbdump.tar.bz2";

console.log("MusicBrainz Sample Relationship Analyzer\n");

// STEP 1: confirm files exist
const files = execSync(
  `tar -tjf ${DUMP} | grep l_recording_recording | head -20`,
  { encoding: "utf8" }
);

console.log("Found relationship table:\n", files);

const sampleLines = execSync(
  `tar -xjOf ${DUMP} mbdump/l_recording_recording | head -20`,
  { encoding: "utf8" }
);

console.log("\nRAW SAMPLE ROWS:\n");
console.log(sampleLines);