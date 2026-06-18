const memoryCache = require("./caches/recordingContextMap");

async function getRecordingContextCachedMemory(
  recordingId,
  fetchRecordingContext
) {
  const cached = memoryCache.get(recordingId);

  if (cached) {
    console.log(
      `[MEMORY HIT] recordingContext ${recordingId}`
    );
    return cached;
  }

  const result = await fetchRecordingContext(recordingId);

  memoryCache.set(recordingId, result);

  console.log(
    `[MEMORY STORE] recordingContext ${recordingId}`
  );

  return result;
}

module.exports = getRecordingContextCachedMemory;