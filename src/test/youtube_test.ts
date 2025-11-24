import { AppDataSource } from '../db';
import { getSpotifyTrack } from '../utils/spotify/getSpotifyTrack';

async function main() {
  try {
    await AppDataSource.initialize();

    const url = 'https://open.spotify.com/track/72YttnPRxyHe8zCG50jYhj';
    const track = await getSpotifyTrack(url);

    console.log(track);
  } catch (error) {
    if (error instanceof Error) {
      console.error(error.message);
    } else {
      console.error('Unexpected error:', error);
    }
  }
}

main().catch(console.error);
