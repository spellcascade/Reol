import retry from 'async-retry';
import { Track as TidalTrack, getTrackInfo } from 'tidal-music-api';
import { Track } from '../../interfaces/Track';
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

        const tidalTrack = await getTrackInfo(tidalTrackId);
        if (!tidalTrack) {
          throw new Error('Failed to get tidal track');
        }

        const artistsStr = getArtistsString(tidalTrack);
        if (artistsStr === '') {
          throw new Error('Invalid tidal track');
        }

        const track = await getYoutubeTrackByQuery(
          `${artistsStr} - ${tidalTrack.title}`,
          tidalTrack?.duration,
        );

        return {
          ...track,
          metadata: {
            artist: artistsStr,
            title: tidalTrack.title,
          },
        };
      } catch (error) {
        throw error;
      }
    },
    {
      retries: 2,
    },
  );
}

function getArtistsString(tidalTrack: TidalTrack) {
  return tidalTrack.artists.map((a) => a.name).join(', ');
}
