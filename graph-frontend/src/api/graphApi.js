export async function loadGraph()
{
  const res =
    await fetch("/data/graph.json");

  return await res.json();
}

export async function loadSampleIndex() {
  const res =
    await fetch("/data/sampleEdgeIndex.json");

  return await res.json();
}