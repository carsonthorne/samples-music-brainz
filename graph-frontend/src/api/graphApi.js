export async function loadGraph()
{
  const res =
    await fetch("/data/graph.json");

  return await res.json();
}