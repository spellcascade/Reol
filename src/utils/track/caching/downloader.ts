import getYouTubeID from 'get-youtube-id';
import PQueue from 'p-queue';
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { isOpusDurationValid } from './opus';
import appRootPath from 'app-root-path';

const ytdlpQueue = new PQueue({ concurrency: 2 });

export async function runYtDlpDownload(
  url: string,
  duration: number,
  cacheDir: string
): Promise<void> {
  return ytdlpQueue.add(() => {
    return new Promise<void>((resolve, reject) => {
      const videoId = getYouTubeID(url);
      if (!videoId) return reject(new Error('Could not extract videoId'));

      const tmpPath = path.join(cacheDir, `${videoId}.part.opus`);
      const finalPath = path.join(cacheDir, `${videoId}.opus`);
      const cookiesPath = `${appRootPath}/cookies.txt`;

      const ytdlp = spawn('yt-dlp', [
        '--cookies',
        cookiesPath,
        '-x',
        '--audio-format',
        'opus',
        '--audio-quality',
        '5',
        '--output',
        path.join(cacheDir, '%(id)s.part.opus'),
        '--ffmpeg-location',
        '/usr/bin/ffmpeg',
        url,
      ]);

      ytdlp.on('close', async (code) => {
        if (code === 0) {
          try {
            if (fs.existsSync(tmpPath)) {
              const isValid = await isOpusDurationValid(tmpPath, duration);
              if (!isValid) {
                await fs.promises.unlink(tmpPath).catch(() => {});
                return reject(new Error('Invalid opus stream'));
              }

              fs.renameSync(tmpPath, finalPath);
              console.log(`[CACHE] Download complete: ${videoId}`);
            }

            for (const f of fs.readdirSync(cacheDir)) {
              if (f.endsWith('.part.opus')) {
                const stale = path.join(cacheDir, f);
                try {
                  fs.unlinkSync(stale);
                } catch {}
              }
            }
            resolve();
          } catch (err) {
            console.error(`[CACHE] Rename failed for ${videoId}:`, err);
            reject(err);
          }
        } else {
          console.error(`[CACHE] yt-dlp failed for ${videoId} (code ${code})`);
          reject(new Error(`yt-dlp exited with code ${code}`));
        }
      });

      ytdlp.on('error', reject);
    });
  });
}
