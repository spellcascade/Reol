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

      let ytdlp: ReturnType<typeof spawn>;
      try {
        ytdlp = spawn('yt-dlp', [
          '--cookies',
          cookiesPath,
          '--no-cache-dir',
          '--format',
          'bestaudio[ext=opus]/bestaudio',
          '--audio-format',
          'opus',
          '--output',
          path.join(cacheDir, '%(id)s.part.opus'),
          '--concurrent-fragments',
          '4',
          '--fragment-retries',
          '10',
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
          if (!fs.existsSync(tmpPath)) {
            return reject(
              new Error('yt-dlp did not create expected part file')
            );
          }

          const isValid = await isOpusDurationValid(tmpPath, duration);
          if (!isValid) {
            await fs.promises.unlink(tmpPath).catch(() => {});
            return reject(new Error('Invalid opus stream'));
          }

          fs.renameSync(tmpPath, finalPath);
          console.log(`[CACHE] Download complete: ${videoId}`);

          for (const f of fs.readdirSync(cacheDir)) {
            if (f.startsWith(videoId) && f.endsWith('.part.opus')) {
              const stale = path.join(cacheDir, f);
              try {
                fs.unlinkSync(stale);
              } catch {}
            }
          }

          resolve();
        } catch (err) {
          console.error(`[CACHE] Post-processing failed for ${videoId}:`, err);
          reject(err);
        }
      });

      ytdlp.on('error', reject);
    });
  });
}
