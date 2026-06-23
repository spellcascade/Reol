import { AppDataSource } from '..';
import { SongRequest } from '../entities/SongRequest';
import { Track } from '../../interfaces/Track';
import { saveSongRequest } from './saveSongRequest';
import { normalizeYoutubeTitle } from '../../utils/youtube/normalizeYoutubeTitle';

interface SaveSongRequestForTrackParams {
  track: Track;
  authorId: string;
  guildId: string;
}

export async function saveSongRequestForTrack({
  track,
  authorId,
  guildId,
}: SaveSongRequestForTrackParams): Promise<void> {
  const repo = AppDataSource.getRepository(SongRequest);
  const existingRequest = await repo.findOne({
    where: { url: track.url },
    order: { id: 'ASC' },
  });

  const normalizedTitle =
    existingRequest?.normalizedTitle || normalizeYoutubeTitle(track.title);

  await saveSongRequest({
    url: track.url,
    title: track.title,
    authorId,
    guildId,
    normalizedTitle,
  });
}
