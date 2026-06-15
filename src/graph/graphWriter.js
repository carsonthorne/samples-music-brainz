const fs = require("fs");
const path = require("path");

function writeGraph(graph)
{
  const outPath = path.join(
    __dirname,
    "../../graph-frontend/public/data/graph.json"
  );

  fs.mkdirSync(
    path.dirname(outPath),
    { recursive: true }
  );

  fs.writeFileSync(
    outPath,
    JSON.stringify(graph, null, 2)
  );
}

module.exports = writeGraph;