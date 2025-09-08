import { YoutubeClient } from '../external/youtube/YoutubeClient';
import { Track } from '../interfaces/Track';
import { isSpotifyURL } from './helpers';
import { getSpotifyPlaylist } from './spotify/getSpotifyPlaylist';

export interface Playlist {
  title: string;
  url: string;
  tracks: Track[];
}

export async function getPlaylist(url: string): Promise<Playlist> {
  const isSpotify = isSpotifyURL(url);
  if (isSpotify) {
    return getSpotifyPlaylist(url);
  }

  const yt = await YoutubeClient.create();
  return yt.playlistByURL(url);
}
