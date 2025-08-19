import { AppDataSource } from '../db';
import { getSimilarTracks } from '../external/spotify/getSimilarTracks';
import { RadioSession } from '../interfaces/RadioSession';

async function main() {
  await AppDataSource.initialize();

  const tracks = await getSimilarTracks('6wVWJl64yoTzU27EI8ep20');

  const radio = new RadioSession(
    tracks.map((t) => ({
      spotifyId: t.id,
      title: t.title,
    }))
  );

  console.log(radio.getTracks());
  console.log(radio.getNextTrack());
  console.log(radio.getTracks());
}

main().catch(console.error);
