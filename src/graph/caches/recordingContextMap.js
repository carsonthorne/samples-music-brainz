const recordingContextMap = new Map();

function get(recordingId) {
  return recordingContextMap.get(recordingId);
}

function set(recordingId, value) {
  recordingContextMap.set(recordingId, value);
}

function has(recordingId) {
  return recordingContextMap.has(recordingId);
}

module.exports = {
  get,
  set,
  has
};