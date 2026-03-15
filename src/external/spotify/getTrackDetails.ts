import fetch from 'isomorphic-unfetch';
const { getDetails } = require('spotify-url-info')(fetch);

interface TrackDetails {
  id: string;
  name: string;
  durationSec: number;
  artists: string;
}

export async function getTrackDetails(
  trackId: string,
): Promise<TrackDetails | null> {
  try {
    const data = await getDetails(`https://open.spotify.com/track/${trackId}`);
    const track = data?.tracks?.[0];
    if (!track) return null;

    if (typeof track.name !== 'string') return null;
    if (typeof track.duration !== 'number') return null;
    if (typeof track.artist !== 'string') return null;
    if (track.artist === '') return null;

    return {
      id: trackId,
      artists: track.artist,
      name: track.name,
      durationSec: Math.floor(track.duration / 1000),
    };
  } catch {
    return null;
  }
}
