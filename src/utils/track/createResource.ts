import { createAudioResource, demuxProbe } from '@discordjs/voice';
import { spawn } from 'child_process';
import { paths } from '../../constants/paths';
import fs from 'fs';
import path from 'path';
import appRootPath from 'app-root-path';

const logPath = path.join(appRootPath.path, 'yt-dlp.log');
const logStream = fs.createWriteStream(logPath, { flags: 'a' });

export async function createResource(url: string) {
  let proc: any;
  try {
    proc = spawn(
      'yt-dlp',
      [
        '--no-cache-dir',
        '--ignore-config',
        '--no-playlist',
        '--newline',
        '-vU',
        '--format',
        'bestaudio[acodec=opus][ext=webm]/bestaudio[acodec=opus]/bestaudio[ext=webm]/bestaudio[ext=m4a]/bestaudio/best',
        '--concurrent-fragments',
        '4',
        '--fragment-retries',
        '10',
        '--retry-sleep',
        '0.5',
        '--sleep-interval',
        '2',
        '--cookies',
        paths.cookies,
        '-o',
        '-',
        url,
      ],
      {
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    );

    proc.on('error', (err: any) => {
      console.error('[yt-dlp error] Failed to spawn yt-dlp:', err);
    });

    proc.stderr?.on('data', (chunk: any) => {
      const lines = chunk.toString().split('\n');

      for (const line of lines) {
        if (!line.trim()) continue;

        logStream.write(`[${new Date().toISOString()}] ${line.trim()}\n`);
      }
    });

    if (!proc.stdout) {
      throw new Error('No stream from yt-dlp');
    }

    const { stream, type } = await demuxProbe(proc.stdout);

    const resource = createAudioResource(stream, {
      inputType: type,
    });

    const killProc = () => {
      if (!proc.killed) {
        proc.kill('SIGKILL');
      }
    };

    resource.playStream.on('close', killProc);
    resource.playStream.on('error', killProc);

    return resource;
  } catch (err: unknown) {
    console.log('error creating resource', err);
    if (proc && !proc.killed) {
      proc.kill('SIGKILL');
    }

    throw err;
  }
}
