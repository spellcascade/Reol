import { Track } from '../interfaces/Track';
import { isSpotifyURL, isYoutubeURL } from './helpers';
import { getSpotifyTrack } from './spotify/getSpotifyTrack';
import {
  getYoutubeTrackByQuery,
  getYoutubeTrackByURL,
} from './youtube/getYoutubeTrack';

export async function getTrack(query: string): Promise<Track> {
  try {
    const isSpotify = isSpotifyURL(query);
    const isYoutube = isYoutubeURL(query);

    if (isYoutube) {
      return await getYoutubeTrackByURL(query);
    }

    if (isSpotify) {
      return await getSpotifyTrack(query);
    }

    return getYoutubeTrackByQuery(query);
  } catch (error: any) {
    throw error;
  }
}
