import { AppDataSource } from '..';
import { SongRequest } from '../entities/SongRequest';

export async function saveSongRequest({
  authorId,
  guildId,
  url,
  title,
  spotifyId,
}: {
  url: string;
  title: string;
  authorId: string;
  guildId: string;
  spotifyId?: string;
}) {
  const repo = AppDataSource.getRepository(SongRequest);

  await repo.save({
    url,
    title,
    requestedBy: authorId,
    guildId,
    spotifyId,
  });
}
