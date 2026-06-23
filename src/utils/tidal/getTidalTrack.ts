import retry from 'async-retry';
import { Track } from '../../interfaces/Track';
import { getTrackDetails } from '../../external/tidal/getTrackDetails';
import { getYoutubeTrackByQuery } from '../youtube/getYoutubeTrack';
import { getTidalTrackId } from '../helpers';

export async function getTidalTrack(url: string): Promise<Track> {
  return retry(
    async () => {
      try {
        const tidalTrackId = getTidalTrackId(url);
        if (!tidalTrackId) {
          throw new Error('Invalid tidal track id');
        }

        const tidalTrack = await getTrackDetails(tidalTrackId);
        if (!tidalTrack) {
          throw new Error('Failed to get tidal track');
        }

        const track = await getYoutubeTrackByQuery(
          `${tidalTrack.artists} - ${tidalTrack.title}`,
          tidalTrack.durationSec,
        );

        return track;
      } catch (error) {
        throw error;
      }
    },
    {
      retries: 2,
    },
  );
}
