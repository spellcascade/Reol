import retry from 'async-retry';
import { Track } from '../../interfaces/Track';
import { getYoutubeTrackByQuery } from '../youtube/getYoutubeTrack';
import { SPOTIFY_TRACK_REGEX } from '../helpers';
import { getTrackDetails } from '../../external/spotify/getTrackDetails';

export async function getSpotifyTrack(url: string): Promise<Track> {
  return retry(
    async () => {
      try {
        const spotifyTrackId = url.match(SPOTIFY_TRACK_REGEX)?.[1];
        if (!spotifyTrackId) {
          throw new Error('Invalid spotify track id');
        }

        const spotifyTrack = await getTrackDetails(spotifyTrackId);
        if (!spotifyTrack) {
          throw new Error('Failed to get spotify track details');
        }

        const track = await getYoutubeTrackByQuery(
          `${spotifyTrack.artists} - ${spotifyTrack.name}`,
          spotifyTrack?.durationSec,
        );

        return {
          ...track,
          metadata: {
            artist: spotifyTrack.artists,
            title: spotifyTrack.name,
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
