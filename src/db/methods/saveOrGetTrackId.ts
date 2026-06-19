import { AppDataSource } from '..';
import { Track } from '../entities/Track';

interface SaveOrGetTrackIdParams {
  name?: string;
  artist?: string;
  isrc?: string;
}

export async function saveOrGetTrackId({
  name,
  artist,
  isrc,
}: SaveOrGetTrackIdParams): Promise<number | null> {
  if (!isrc || isrc.trim() === '') {
    return null;
  }

  const normalizedIsrc = isrc.trim();
  const repo = AppDataSource.getRepository(Track);
  const existingTrack = await repo.findOne({
    where: {
      isrc: normalizedIsrc,
    },
    order: {
      id: 'ASC',
    },
  });

  if (existingTrack) {
    return existingTrack.id;
  }

  const savedTrack = await repo.save({
    name: name ?? '',
    artist: artist ?? '',
    isrc: normalizedIsrc,
  });

  return savedTrack.id;
}
