import { getTrackDetails } from '../external/spotify/getTrackDetails';

async function main() {
  try {
    const track = await getTrackDetails('0wbDgMuAoy7O7pL3a69uZx');
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
