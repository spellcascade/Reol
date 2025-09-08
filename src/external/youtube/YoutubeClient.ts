import getYouTubeID from 'get-youtube-id';
import { Innertube, Log } from 'youtubei.js';
import { Track } from '../../interfaces/Track';
import { formatDuration } from '../../utils/formatDuration';
import { getYtCookiesString } from '../../utils/getYtCookiesString';

export class YoutubeClient {
  client: Innertube;
  private static instance: YoutubeClient | null = null;

  constructor(client: Innertube) {
    Log.setLevel(Log.Level.NONE);

    this.client = client;
  }

  static async create() {
    if (YoutubeClient.instance) {
      return YoutubeClient.instance;
    }

    const cookie = await getYtCookiesString();
    const client = await Innertube.create({
      retrieve_player: false,
      enable_session_cache: true,
      generate_session_locally: true,
      ...(cookie && { cookie }),
    });

    YoutubeClient.instance = new YoutubeClient(client);
    return new YoutubeClient(client);
  }

  public async byURL(url: string): Promise<Track | null> {
    try {
      const id = getYouTubeID(url);
      if (!id) throw new Error('Invalid YouTube URL');

      const res = await this.client.getBasicInfo(id);

      const duration = res.basic_info.duration;
      if (typeof duration != 'number' || duration < 0) {
        throw new Error('Invalid video duration');
      }

      return {
        url: 'https://www.youtube.com/watch?v=' + id,
        title: res.basic_info.title || 'No title',
        durationSec: duration,
        durationFormatted: formatDuration(duration),
      };
    } catch (error) {
      console.log('Error byURL', error);
      throw error;
    }
  }

  public async byQuery(query: string): Promise<Track | null> {
    try {
      const res = await this.client.search(query, {
        type: 'video',
      });

      const vids = (res.videos || []).filter((v) => v.type === 'Video');
      const video: any = vids[0];
      if (!video) return null;

      const duration = video?.duration?.seconds;
      if (typeof duration != 'number' || duration < 0) {
        throw new Error('Invalid video duration');
      }

      return {
        url: `https://www.youtube.com/watch?v=${video.id}`,
        title: video?.title?.text || 'No title',
        durationFormatted: formatDuration(duration),
        durationSec: duration,
      };
    } catch (error) {
      console.log('Error byQuery', error);
      throw error;
    }
  }
}
