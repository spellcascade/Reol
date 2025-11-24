import { spotifyFetch } from './spotifyAxiosClient';

export interface TrackArtist {
  id: string;
  name: string;
}

export interface TrackDetails {
  id: string;
  name: string;
  popularity: number;
  durationSec: number;
  artists: TrackArtist[];
}

export async function getTrackDetails(
  trackId: string
): Promise<TrackDetails | null> {
  try {
    const details = await spotifyFetch(`/tracks/${trackId}`);

    return {
      ...details,
      durationSec: Math.floor(details.duration_ms / 1000),
    };
  } catch (error) {
    console.error('Failed to fetch track details:', error);
    throw error;
  }
}
