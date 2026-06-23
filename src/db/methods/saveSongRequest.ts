import { AppDataSource } from '..';
import { SongRequest } from '../entities/SongRequest';

export async function saveSongRequest({
  authorId,
  guildId,
  normalizedTitle,
  trackId,
  url,
  title,
}: {
  url: string;
  title: string;
  authorId: string;
  guildId: string;
  normalizedTitle: string;
  trackId?: number | null;
}) {
  const repo = AppDataSource.getRepository(SongRequest);

  await repo.save({
    url,
    title,
    requestedBy: authorId,
    guildId,
    trackId: trackId ?? null,
    normalizedTitle,
  });
}
