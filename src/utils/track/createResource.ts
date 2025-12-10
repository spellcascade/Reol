import { createAudioResource, StreamType } from '@discordjs/voice';
import fs from 'fs';
import { cacheTrack, getCachePath, isOpusCached } from './caching/manager';
import appRootPath from 'app-root-path';
import { execFile, spawn } from 'child_process';
import getYouTubeID from 'get-youtube-id';
import { Track } from '../../interfaces/Track';
import path from 'path';

export async function createResource(
  track: Track,
  onUpdate: (msg: string) => Promise<void>,
  shouldCache?: boolean
) {
  try {
    await onUpdate('Processing...');
    const videoId = getYouTubeID(track.url);
    if (!videoId) {
      throw new Error('Failed to extract videoId');
    }
    if (!shouldCache) {
      return createStreamingResource(track.url);
    }

    const cachePath = getCachePath(videoId);
    const isCached = await isOpusCached(videoId);
    if (isCached) {
      return await createOpusResource(cachePath);
    }

    const downloaded = await cacheTrack(track);
    if (!downloaded) {
      throw new Error('Cache download failed');
    }

    await onUpdate('Success!');
    return await createOpusResource(downloaded);
  } catch (err: any) {
    const message = err.message || '';
    await onUpdate(`Error: ${message}.`);
    throw err;
  }
}

async function createOpusResource(path: string) {
  const container = await detectOpusContainer(path);
  let options: { inputType?: StreamType } = {};

  if (container === 'ogg') {
    options.inputType = StreamType.OggOpus;
  } else if (container === 'webm') {
    options.inputType = StreamType.WebmOpus;
  }

  return createAudioResource(fs.createReadStream(path), options);
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
      '--sleep-interval',
      '2',
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

export function detectOpusContainer(
  filePath: string
): Promise<'ogg' | 'webm' | null> {
  return new Promise((resolve) => {
    execFile(
      'ffprobe',
      ['-v', 'error', '-show_format', '-of', 'json', filePath],
      (err, stdout) => {
        if (err) return resolve(null);

        try {
          const info = JSON.parse(stdout);
          const format = info?.format?.format_name;

          if (format?.includes('ogg')) return resolve('ogg');
          if (format?.includes('webm')) return resolve('webm');

          resolve(null);
        } catch {
          resolve(null);
        }
      }
    );
  });
}
