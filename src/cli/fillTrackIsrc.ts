import { IsNull, Not } from 'typeorm';
import { AppDataSource } from '../db';
import { Track } from '../db/entities/Track';
import { spotifyFetch } from '../external/spotify/spotifyAxiosClient';

async function main() {
  await AppDataSource.initialize();
  const repo = AppDataSource.getRepository(Track);

  const tracks = await repo.find({
    where: {
      spotifyId: Not(IsNull()),
      isrc: IsNull(),
    },
    select: { id: true, spotifyId: true },
  });

  const ids = tracks
    .map((t) => t.spotifyId)
    .filter((v): v is string => Boolean(v));

  console.log(`Need ISRC for ${ids.length} tracks`);

  const bySpotifyIdToTrackId = new Map<string, number>();
  for (const t of tracks) {
    if (t.spotifyId) bySpotifyIdToTrackId.set(t.spotifyId, t.id);
  }

  const batches = chunk(ids, 50);

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];

    const isrcMap = await getSpotifyTracksIsrcBatch(batch);

    for (const [spotifyId, isrc] of isrcMap.entries()) {
      if (!isrc) continue;

      const trackId = bySpotifyIdToTrackId.get(spotifyId);
      if (!trackId) continue;

      await repo.update({ id: trackId, isrc: IsNull() }, { isrc });
    }

    console.log(`Batch ${i + 1}/${batches.length} done`);
    await sleep(150);
  }

  await AppDataSource.destroy();
}

type SpotifyTrack = { id: string; external_ids?: { isrc?: string } };

async function getSpotifyTracksIsrcBatch(
  spotifyIds: string[]
): Promise<Map<string, string | null>> {
  const ids = spotifyIds.join(',');
  const res = await spotifyFetch(`/tracks?ids=${encodeURIComponent(ids)}`);

  const out = new Map<string, string | null>();
  const tracks: Array<SpotifyTrack | null> = res.tracks ?? [];

  for (const t of tracks) {
    if (!t?.id) continue;
    out.set(t.id, t.external_ids?.isrc ?? null);
  }

  for (const id of spotifyIds) {
    if (!out.has(id)) out.set(id, null);
  }

  return out;
}

function chunk<T>(arr: T[], size: number): T[][] {
  const res: T[][] = [];
  for (let i = 0; i < arr.length; i += size) res.push(arr.slice(i, i + size));
  return res;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

main().catch(console.error);
