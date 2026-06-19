import { Track as PlaybackTrack } from '../../interfaces/Track';
import { saveOrGetTrackId } from './saveOrGetTrackId';
import { saveSongRequest } from './saveSongRequest';

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

  await saveSongRequest({
    url: track.url,
    title: track.title,
    authorId,
    guildId,
    trackId,
  });
}
