import { createAudioResource, StreamType } from '@discordjs/voice';
import fs from 'fs';
import { cacheTrack } from './caching/manager';
import appRootPath from 'app-root-path';
import { spawn } from 'child_process';

export async function createResource(url: string, shouldCache?: boolean) {
  try {
    if (!shouldCache) {
      console.log('[CACHE] Skipping caching (streaming directly)');
      const process = spawn(
        'yt-dlp',
        [
          '--ffmpeg-location',
          '/usr/bin/ffmpeg',
          '--format',
          'bestaudio[acodec=opus]/bestaudio',
          '--cookies',
          `${appRootPath}/cookies.txt`,
          '-o',
          '-',
          '--quiet',
          url,
        ],
        { stdio: ['ignore', 'pipe', 'ignore'] }
      );

      const stdout = process.stdout;
      if (!stdout) throw new Error('No stream found');
      return createAudioResource(stdout, { inputType: StreamType.WebmOpus });
    }

    const cachePath = await cacheTrack(url);
    const resource = createAudioResource(fs.createReadStream(cachePath), {
      inputType: StreamType.OggOpus,
    });

    return resource;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to create resource: ${error.message}`);
    }
    throw new Error('Failed to create resource, unknown reason');
  }
}
