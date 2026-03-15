import { getTidalTrack } from '../utils/tidal/getTidalTrack';

async function main() {
  try {
    const url = 'https://tidal.com/track/139130240/u';

    const track = await getTidalTrack(url);
    console.log(track);
  } catch (error) {
    console.log(error);
  }
}

main().catch(console.error);
