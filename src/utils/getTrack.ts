import { Track } from '../interfaces/Track';
import { isSpotifyURL, isTidalTrack, isYoutubeURL } from './helpers';
import { getSpotifyTrack } from './spotify/getSpotifyTrack';
import { getTidalTrack } from './tidal/getTidalTrack';
import {
  getYoutubeTrackByQuery,
  getYoutubeTrackByURL,
} from './youtube/getYoutubeTrack';

export async function getTrack(query: string): Promise<Track> {
  try {
    if (isYoutubeURL(query)) {
      return await getYoutubeTrackByURL(query);
    }

    if (isSpotifyURL(query)) {
      return await getSpotifyTrack(query);
    }

    if (isTidalTrack(query)) {
      return await getTidalTrack(query);
    }

    return getYoutubeTrackByQuery(query);
  } catch (error: any) {
    throw error;
  }
}
