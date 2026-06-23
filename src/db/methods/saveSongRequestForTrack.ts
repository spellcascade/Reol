import { AppDataSource } from '..';
import { SongRequest } from '../entities/SongRequest';
import { Track as PlaybackTrack } from '../../interfaces/Track';
import { saveOrGetTrackId } from './saveOrGetTrackId';
import { saveSongRequest } from './saveSongRequest';
import { normalizeYoutubeTitle } from '../../utils/youtube/normalizeYoutubeTitle';

interface SaveSongRequestForTrackParams {
  track: PlaybackTrack;
  authorId: string;
  guildId: string;
}

export async function saveSongRequestForTrack({
  track,
  authorId,
  guildId,
}: SaveSongRequestForTrackParams): Promise<void> {
  const trackId = await saveOrGetTrackId({
    name: track.metadata?.title,
    artist: track.metadata?.artist,
    isrc: track.metadata?.isrc,
  });

  const repo = AppDataSource.getRepository(SongRequest);
  const existingRequest = await repo.findOne({
    where: { url: track.url },
    order: { id: 'ASC' },
  });

  const normalizedTitle =
    existingRequest?.normalizedTitle.trim() ||
    (track.metadata?.artist && track.metadata?.title
      ? `${track.metadata.artist.trim()} - ${track.metadata.title.trim()}`
      : normalizeYoutubeTitle(track.title));

  await saveSongRequest({
    url: track.url,
    title: track.title,
    authorId,
    guildId,
    trackId,
    normalizedTitle,
  });
}
