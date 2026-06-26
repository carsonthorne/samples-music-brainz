const searchArtist = require("./api/musicbrainz/searchArtist");
const getAlbums = require("./api/musicbrainz/getAlbums");
const getReleaseFromGroup = require("./api/musicbrainz/getReleaseFromGroup");
const getTracksFromRelease = require("./api/musicbrainz/getTracksFromRelease");
const getSamplesFromRecording = require("./api/musicbrainz/getSamplesFromRecording");

async function main() {
  const artist = await searchArtist("a tribe called quest");

  console.log("Artist:", artist.name);

  const albums = await getAlbums(artist.id);

  for (const album of albums.slice(0, 1)) {
    // limit for testing
    console.log(`\nAlbum: ${album.title}`);

    const release = await getReleaseFromGroup(album.id);
    if (!release) continue;

    const tracks = await getTracksFromRelease(release.id);

    // tracks.forEach(track => {
    // console.log(`  - ${track.title}`);
    // });

    for (const track of tracks) {
      console.log(`  - ${track.title}`);

      const samples = await getSamplesFromRecording(track.recordingId);

      if (samples.length > 0) {
        samples.forEach((s) => {
          console.log(`     ↳ samples: ${s.title} - ${s.artist}`);
        });
      }
    }
  }
}

main();
