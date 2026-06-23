import { AppDataSource } from '..';
import { SongRequest } from '../entities/SongRequest';

export async function saveSongRequest({
  authorId,
  guildId,
  normalizedTitle,
  url,
  title,
}: {
  url: string;
  title: string;
  authorId: string;
  guildId: string;
  normalizedTitle: string;
}) {
  const repo = AppDataSource.getRepository(SongRequest);

  await repo.save({
    url,
    title,
    requestedBy: authorId,
    guildId,
    normalizedTitle,
  });
}
