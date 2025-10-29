import { createAudioResource, StreamType } from '@discordjs/voice';
import fs from 'fs';
import { cacheTrack, getCachePath, isCached } from './caching/manager';
import appRootPath from 'app-root-path';
import { spawn } from 'child_process';
import getYouTubeID from 'get-youtube-id';

export async function createResource(url: string, shouldCache?: boolean) {
  const videoId = getYouTubeID(url);
  if (!videoId) throw new Error('Failed to extract videoId');

  const cacheExists = isCached(videoId);

  try {
    if (cacheExists) {
      const opus = getCachePath(videoId);
      console.log(opus);

      return createAudioResource(fs.createReadStream(opus), {
        inputType: StreamType.OggOpus,
      });
    }

    const process = spawn(
      'yt-dlp',
      [
        '--ffmpeg-location',
        '/usr/bin/ffmpeg',
        '-f',
        'bestaudio/best',
        '--cookies',
        `${appRootPath}/cookies.txt`,
        '-o',
        '-',
        url,
      ],
      { stdio: ['ignore', 'pipe', 'ignore'] }
    );

    const stdout = process.stdout;
    if (!stdout) throw new Error('No stream found');

    return createAudioResource(stdout);
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to create resource: ${error.message}`);
    }
    throw new Error('Failed to create resource, unknown reason');
  } finally {
    if (shouldCache && !cacheExists) {
      cacheTrack(url);
    }
  }
}
