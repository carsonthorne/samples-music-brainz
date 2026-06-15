export function handleNodeClick(
  node,
  graph
)
{
  const links =
    graph.links.filter(
      link =>
        link.source.id === node.id ||
        link.target.id === node.id ||
        link.source === node.id ||
        link.target === node.id
    );

  console.log(node);
  console.log(links);
}