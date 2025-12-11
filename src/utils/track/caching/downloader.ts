import getYouTubeID from 'get-youtube-id';
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { isOpusDurationValid } from './opus';
import { paths } from '../../../constants/paths';

export async function runYtDlpDownload(
  url: string,
  duration: number
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const videoId = getYouTubeID(url);
    if (!videoId) return reject(new Error('Could not extract videoId'));

    const tmpPath = path.join(paths.dirs.cache, `${videoId}.part.opus`);
    const finalPath = path.join(paths.dirs.cache, `${videoId}.opus`);

    let ytdlp: ReturnType<typeof spawn>;
    try {
      ytdlp = spawn('yt-dlp', [
        '--cookies',
        paths.cookies,
        '--no-cache-dir',
        '--format',
        'bestaudio[ext=opus]/bestaudio',
        '--audio-format',
        'opus',
        '--output',
        path.join(paths.dirs.cache, '%(id)s.part.opus'),
        '--concurrent-fragments',
        '4',
        '--fragment-retries',
        '10',
        '--sleep-interval',
        '2',
        '--retry-sleep',
        '0.5',
        url,
      ]);
    } catch (err) {
      return reject(err);
    }

    ytdlp.stderr?.on('data', (d) =>
      console.error(`[yt-dlp:${videoId}]`, d.toString())
    );
    ytdlp.stdout?.on('data', (d) =>
      console.log(`[yt-dlp:${videoId}]`, d.toString())
    );

    ytdlp.on('close', async (code) => {
      if (code !== 0) {
        console.error(`[CACHE] yt-dlp failed for ${videoId} (code ${code})`);
        return reject(new Error(`yt-dlp exited with code ${code}`));
      }

      try {
        try {
          await fs.promises.access(tmpPath, fs.constants.R_OK);
        } catch {
          return reject(new Error('yt-dlp did not create expected part file'));
        }

        const isValid = await isOpusDurationValid(tmpPath, duration);
        if (!isValid) {
          await fs.promises.unlink(tmpPath).catch(() => {});
          return reject(new Error('Invalid opus stream'));
        }

        await fs.promises.rename(tmpPath, finalPath);
        console.log(`[CACHE] Download complete: ${videoId}`);

        const files = await fs.promises.readdir(paths.dirs.cache);
        await Promise.all(
          files
            .filter((f) => f.startsWith(videoId) && f.endsWith('.part.opus'))
            .map((f) =>
              fs.promises.unlink(path.join(paths.dirs.cache, f)).catch(() => {})
            )
        );

        resolve();
      } catch (err) {
        console.error(`[CACHE] Post-processing failed for ${videoId}:`, err);
        reject(err);
      }
    });

    ytdlp.on('error', reject);
  });
}
