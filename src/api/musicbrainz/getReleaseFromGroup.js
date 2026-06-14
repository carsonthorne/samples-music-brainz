const fetch = require("node-fetch");

async function getReleaseFromGroup(releaseGroupId) {
    const url = `https://musicbrainz.org/ws/2/release?release-group=${releaseGroupId}&fmt=json`;

    const res = await fetch(url, {
        headers: {
        "User-Agent": "my-music-app/1.0 ( your@email.com )"
        }
    });

    const data = await res.json();

    return data.releases[0]; // pick first release
}

module.exports = getReleaseFromGroup;