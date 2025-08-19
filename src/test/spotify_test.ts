import { AppDataSource } from '../db';
import { getSimilarTracks } from '../external/spotify/getSimilarTracks';
import { SPOTIFY_TRACK_REGEX } from '../utils/helpers';

async function main() {
  try {
    await AppDataSource.initialize();

    const url = process.argv[2];
    if (!url) throw new Error('Please provide a Spotify track URL');

    const id = url.match(SPOTIFY_TRACK_REGEX)?.[1];
    if (!id) throw new Error('Invalid Spotify track URL');

    const tracks = await getSimilarTracks(id);

    for (const track of tracks) {
      console.log(
        `- [${track.popularity || 'xx'}] https://open.spotify.com/track/${
          track.id
        } : ${track.title}`
      );
    }
  } catch (error) {
    if (error instanceof Error) {
      console.error(error.message);
    } else {
      console.error('Unexpected error:', error);
    }
  }
}

main().catch(console.error);
