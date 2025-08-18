import retry from 'async-retry';
import { Track } from '../../interfaces/Track';
import { getYoutubeTrackByQuery } from '../youtube/getYoutubeTrack';
import { SPOTIFY_TRACK_REGEX } from '../helpers';
import { getTrackDetails } from '../../external/spotify/getTrackDetails';
import { isLikelyEnglish } from '../isLikelyEnglish';

export async function getSpotifyTrack(
  url: string,
  lyrics?: boolean
): Promise<Track> {
  return retry(
    async () => {
      try {
        const spotifyTrackId = url.match(SPOTIFY_TRACK_REGEX)?.[1];
        if (!spotifyTrackId) {
          throw new Error('Invalid spotify track id');
        }

        const details = await getTrackDetails(spotifyTrackId);

        const artist = details?.artists?.[0]?.name || '';
        const title = details?.name || '';

        let query = `${artist} - ${title}`;
        if (lyrics && isLikelyEnglish(query)) {
          query += ' lyrics';
        }

        const track = await getYoutubeTrackByQuery(query);

        return {
          ...track,
          metadata: {
            artist: artist,
            title: title,
            spotifyTrackId: url.match(SPOTIFY_TRACK_REGEX)?.[1],
          },
        };
      } catch (error) {
        throw error;
      }
    },
    {
      retries: 2,
    }
  );
}
