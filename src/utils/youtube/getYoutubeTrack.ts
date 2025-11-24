import retry from 'async-retry';
import { YoutubeClient } from '../../external/youtube/YoutubeClient';
import { Track } from '../../interfaces/Track';

export async function getYoutubeTrackByQuery(
  query: string,
  expectedDuration?: number
): Promise<Track> {
  return retry(
    async () => {
      try {
        const yt = await YoutubeClient.create();

        const track = await yt.byQuery(query, {
          expectedDuration,
        });
        if (!track) throw new Error(`No video for ${query} found`);

        return track;
      } catch (error) {
        throw error;
      }
    },
    {
      retries: 2,
    }
  );
}

export async function getYoutubeTrackByURL(url: string): Promise<Track> {
  return retry(
    async () => {
      try {
        const yt = await YoutubeClient.create();

        const track = await yt.byURL(url);
        if (!track) throw new Error(`No video for ${url} found`);

        return track;
      } catch (error: any) {
        throw error;
      }
    },
    {
      retries: 2,
    }
  );
}
