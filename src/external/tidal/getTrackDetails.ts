import { ENV } from '../../utils/ENV';
import { tidalClient } from './tidalClient';

interface JsonApiResource {
  id?: string;
  type?: string;
  attributes?: Record<string, unknown>;
}

interface TidalTrackResponse {
  data?: JsonApiResource;
  included?: JsonApiResource[];
}

export interface TidalTrackDetails {
  id: string;
  title: string;
  durationSec: number;
  artists: string;
}

export async function getTrackDetails(
  trackId: number,
): Promise<TidalTrackDetails | null> {
  const response = await tidalClient.get<TidalTrackResponse>(
    `/tracks/${trackId}`,
    {
      params: {
        countryCode: ENV.TIDAL_COUNTRY_CODE,
        include: 'artists',
      },
    },
  );

  const track = response.data?.data;
  if (!track || track.type !== 'tracks' || typeof track.id !== 'string') {
    return null;
  }

  const title = getTrackTitle(track.attributes);
  const durationSec = parseIsoDurationSeconds(track.attributes?.duration);
  const artists = getArtists(response.data?.included);

  if (!title || durationSec == null || artists === '') {
    return null;
  }

  return {
    id: track.id,
    title,
    durationSec,
    artists,
  };
}

function getTrackTitle(attributes?: Record<string, unknown>) {
  const title = attributes?.title;
  if (typeof title !== 'string' || title === '') {
    return null;
  }

  return title;
}

function getArtists(included?: JsonApiResource[]) {
  if (!included) {
    return '';
  }

  return included
    .filter((item) => item.type === 'artists')
    .map((item) => item.attributes?.name)
    .filter((name): name is string => typeof name === 'string' && name !== '')
    .join(', ');
}

function parseIsoDurationSeconds(duration: unknown): number | null {
  if (typeof duration !== 'string' || duration === '') {
    return null;
  }

  const match = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(duration);
  if (!match) {
    return null;
  }

  const hours = Number(match[1] ?? 0);
  const minutes = Number(match[2] ?? 0);
  const seconds = Number(match[3] ?? 0);

  return hours * 3600 + minutes * 60 + seconds;
}
