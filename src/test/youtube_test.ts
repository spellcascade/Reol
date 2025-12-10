import { getTrack } from '../utils/getTrack';
import { createResource } from '../utils/track/createResource';

async function main() {
  try {
    const track = await getTrack('https://www.youtube.com/watch?v=QK-Z1K67uaA');

    await createResource(
      track,
      async (e) => {
        console.log(e);
      },
      true
    );
  } catch (error) {
    if (error instanceof Error) {
      console.error(error.message);
    } else {
      console.error('Unexpected error:', error);
    }
  }
}

main().catch(console.error);
