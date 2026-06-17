function getLineage(graph, nodeId)
{
  const path = [];

  let current = nodeId;

  while (current)
  {
    path.unshift(current);

    const parents =
      graph.reverseAdjacency?.[current];

    if (!parents || parents.length === 0)
      break;

    // choose first parent (good enough for now)
    current = parents[0].source;
  }

  return path;
}

export default getLineage;