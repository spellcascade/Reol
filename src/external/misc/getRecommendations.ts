import axios from 'axios';
import { Agent } from 'https';
import { TrackArtist } from '../spotify/getTrackDetails';

const agent = new Agent({ keepAlive: true });

interface TrackAlbum {
  name: string;
  images?: { url: string; height: number; width: number }[];
}

interface Track {
  id: string;
  name: string;
  artists: TrackArtist[];
  preview_url: string | null;
  duration_ms: number;
  popularity: number;
  album: TrackAlbum;
}

export interface RecommendationsResponse {
  tracks: Track[];
}

export async function getRecommendations({
  limit,
  seedTrackId,
}: {
  seedTrackId: string;
  limit: number;
}): Promise<Track[]> {
  try {
    const response = await axios.get(
      'https://www.chosic.com/api/tools/recommendations',
      {
        params: {
          seed_tracks: seedTrackId,
          limit,
        },
        headers: {
          'User-Agent':
            'Mozilla/5.0 (X11; Linux x86_64; rv:137.0) Gecko/20100101 Firefox/137.0',
          Accept: 'application/json, text/javascript, */*; q=0.01',
          'Accept-Language': 'en-US,en;q=0.5',
          'Accept-Encoding': 'gzip, deflate',
          'X-WP-Nonce': 'bfef9dba12',
          app: 'playlist_generator',
          'X-Requested-With': 'XMLHttpRequest',
          Referer: 'https://www.chosic.com/playlist-generator/',
          Cookie: 'pll_language=en',
        },
        httpsAgent: agent,
        timeout: 10000,
      }
    );

    return response.data?.tracks || [];
  } catch (err: any) {
    console.error('Request failed:', err.message);
    if (err.response) {
      console.error('Status:', err.response.status);
      console.error('Data:', err.response.data);
    }
    throw err;
  }
}
