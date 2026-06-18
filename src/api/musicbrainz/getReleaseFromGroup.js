const fetch = require("node-fetch");
const fetchWithCache = require("../../utils/fetchWithCache");

async function getReleaseFromGroup(releaseGroupId) {
  return fetchWithCache(
    "releases",
    releaseGroupId,
    async () => {
      console.log(
        `[API CALL] Fetching release for group ${releaseGroupId}`
      );

      const url =
        `https://musicbrainz.org/ws/2/release?release-group=${releaseGroupId}&fmt=json`;

      const res = await fetch(url, {
        headers: {
          "User-Agent": "my-app/1.0 (your@email.com)"
        }
      });

      const data = await res.json();

      return data.releases?.[0] || null;
    }
  );
}

module.exports = getReleaseFromGroup;