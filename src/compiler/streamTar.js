const { spawn } = require("child_process");
const readline = require("readline");

function streamTar(file, innerPath) {
  const tar = spawn("tar", ["-xjOf", file, innerPath]);

  const rl = readline.createInterface({
    input: tar.stdout,
    crlfDelay: Infinity,
  });

  tar.stderr.on("data", (d) => {
    console.error("[tar error]", d.toString());
  });

  return rl;
}

module.exports = { streamTar };
