import { createAudioResource, demuxProbe } from '@discordjs/voice';
import { paths } from '../../constants/paths';
import { YtDlp, YtDlpError } from '../../external/ytdlp/ytdlp';

const ytDlp = new YtDlp({
  cacheDir: paths.dirs.cache,
  cookiesPath: paths.ytCookies,
});

export async function createResource(
  url: string,
  expectedDurationSec?: number,
) {
  let audio: Awaited<ReturnType<YtDlp['getStream']>> | undefined;

  try {
    audio = await ytDlp.getStream(url, expectedDurationSec);
    const currentAudio = audio;
    const { stream, type } = await demuxProbe(currentAudio.stream);
    const resource = createAudioResource(stream, {
      inputType: type,
    });

    resource.playStream.on('close', () => currentAudio.close());
    resource.playStream.on('error', () => currentAudio.close());

    return resource;
  } catch (err) {
    audio?.close();

    if (err instanceof YtDlpError) {
      err.userMessage = getYtDlpUserMessage(err);
    }

    throw err;
  }
}

export function getYtDlpUserMessage(err: unknown): string {
  if (!(err instanceof YtDlpError)) {
    return 'Cannot load track.';
  }

  switch (err.kind) {
    case 'bad_url':
      return 'Invalid YouTube URL.';
    case 'blocked':
      return 'YouTube temporarily blocked the download. Please try again.';
    case 'premium':
      return 'Cannot play premium video.';
    case 'rate_limited':
      return 'YouTube rate limited the bot. Please try again later.';
    case 'unavailable':
      return 'This video is unavailable.';
    case 'private':
      return 'This video is private.';
    case 'age_restricted':
      return 'This video is age restricted.';
    case 'format':
      return 'Could not extract audio from this video.';
    case 'network':
      return 'Network error while loading the track.';
    case 'invalid_file':
      return 'Downloaded audio is invalid or incomplete.';
    case 'unknown':
    default:
      return 'Cannot load track.';
  }
}
