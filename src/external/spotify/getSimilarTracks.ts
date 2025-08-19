import { getBannedArtists } from '../../db/methods/getBannedArtists';
import { removeTrackDuplicates } from '../../utils/removeArrayDuplicates';
import { getRecommendations } from '../misc/getRecommendations';
import { TrackDetails, getTrackDetails } from './getTrackDetails';
import { getSpotifyTrackTitle } from './utils/getSpotifyTrackTitle';

export interface SpotifyTrack extends TrackDetails {
  title: string;
}

export async function getSimilarTracks(id: string): Promise<SpotifyTrack[]> {
  try {
    const trackDetails = await getTrackDetails(id);
    if (!trackDetails) throw new Error(`Unable to get track details for ${id}`);

    const recommendations = await getRecommendations({
      seedTrackId: id,
      limit: 40,
    });

    const bannedArtists = await getBannedArtists();

    const tracks = recommendations
      .filter((t: any) => {
        const artists = (t?.artists || []).map((a: any) => a.id);
        return !bannedArtists.find((b) => artists.includes(b.spotifyId));
      })
      .map((t) => ({
        id: t.id,
        title: getSpotifyTrackTitle(t),
        artist: t.artists?.[0]?.name ?? '',
        popularity: t.popularity,
        artists: t.artists,
        name: t.name,
      })) as SpotifyTrack[];

    const res: SpotifyTrack[] = [
      {
        id: trackDetails.id,
        title: getSpotifyTrackTitle(trackDetails),
        artists: trackDetails.artists,
        popularity: trackDetails.popularity,
        name: trackDetails.name,
      },
      ...tracks,
    ];

    const uniqueTracks = removeTrackDuplicates(res);
    return uniqueTracks.slice(0, 30);
  } catch (error) {
    throw error;
  }
}
