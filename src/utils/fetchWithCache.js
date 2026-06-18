const {
  readCache,
  writeCache
} = require("./cache");

async function fetchWithCache(
  cacheFolder,
  cacheKey,
  fetchFn
)
{
  const cached =
    readCache(
      cacheFolder,
      cacheKey
    );

  if (cached !== null)
  {
    console.log(
      `[CACHE HIT] ${cacheFolder}: ${cacheKey}`
    );

    return cached;
  }

  const result =
    await fetchFn();

  writeCache(
    cacheFolder,
    cacheKey,
    result
  );

  return result;
}

module.exports =
  fetchWithCache;