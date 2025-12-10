import { createAudioResource, StreamType } from '@discordjs/voice';
import fs from 'fs';
import { cacheTrack, getCachePath, isOpusCached } from './caching/manager';
import appRootPath from 'app-root-path';
import { spawn } from 'child_process';
import getYouTubeID from 'get-youtube-id';
import { Track } from '../../interfaces/Track';
import retry from 'async-retry';
import path from 'path';

const MAX_RETRIES = 3;

export async function createResourceWithRetry(
  track: Track,
  onUpdate: (msg: string) => Promise<void>,
  shouldCache?: boolean
) {
  return retry(
    async (_, attempt) => {
      try {
        await onUpdate(`Attempt ${attempt}/${MAX_RETRIES}...`);

        const resource = await createResource(track, shouldCache);
        await onUpdate('Success!');
        return resource;
      } catch (err: any) {
        const message = err.message || '';
        await onUpdate(`Error: ${message}.`);
        throw err;
      }
    },
    {
      retries: MAX_RETRIES - 1,
      minTimeout: 300,
      maxTimeout: 800,
    }
  );
}

async function createResource(track: Track, shouldCache?: boolean) {
  const videoId = getYouTubeID(track.url);
  if (!videoId) {
    throw new Error('Failed to extract videoId');
  }

  const cachePath = getCachePath(videoId);

  try {
    const isCached = await isOpusCached(videoId);
    if (isCached) {
      return createOpusResource(cachePath);
    }

    if (!shouldCache) {
      return createStreamingResource(track.url);
    }

    const downloaded = await cacheTrack(track);
    if (!downloaded || !fs.existsSync(downloaded)) {
      throw new Error('Cache download failed');
    }

    return createOpusResource(downloaded);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(msg);
  }
}

function createOpusResource(path: string) {
  return createAudioResource(fs.createReadStream(path), {
    inputType: StreamType.OggOpus,
  });
}

function createStreamingResource(url: string) {
  const proc = spawn(
    'yt-dlp',
    [
      '--no-cache-dir',
      '--format',
      'bestaudio[ext=webm][acodec=opus]/bestaudio[acodec=opus]',
      '--concurrent-fragments',
      '4',
      '--fragment-retries',
      '10',
      '--retry-sleep',
      '0.5',
      '--ffmpeg-location',
      '/usr/bin/ffmpeg',
      '--cookies',
      path.join(appRootPath.path, 'cookies.txt'),
      '-o',
      '-',
      url,
    ],
    {
      stdio: ['ignore', 'pipe', 'pipe'],
    }
  );

  proc.on('error', (err) => {
    console.error('[STREAM] Failed to spawn yt-dlp:', err);
  });

  proc.stderr?.on('data', (d) => {
    console.warn('[STREAM STDERR]', d.toString());
  });

  if (!proc.stdout) throw new Error('No stream from yt-dlp');

  const resource = createAudioResource(proc.stdout, {
    inputType: StreamType.WebmOpus,
  });

  resource.playStream.on('close', () => proc.kill('SIGKILL'));
  resource.playStream.on('error', () => proc.kill('SIGKILL'));
  return resource;
}
