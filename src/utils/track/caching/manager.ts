import fs from 'fs';
import PQueue from 'p-queue';
import path from 'path';
import { spawn } from 'child_process';
import appRootPath from 'app-root-path';
import getYouTubeID from 'get-youtube-id';
import { ENV } from '../../ENV';

const ytdlpQueue = new PQueue({ concurrency: 1 });
const activeDownloads = new Map<string, Promise<void>>();

const CACHE_DIR = path.join(appRootPath.path, 'cache');
const MAX_CACHE_SIZE_BYTES = ENV.MAX_CACHE_SIZE_GB * 1024 ** 3;

if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });

function getCachePath(videoId: string) {
  return path.join(CACHE_DIR, `${videoId}.opus`);
}

function isCached(videoId: string) {
  return fs.existsSync(getCachePath(videoId));
}

export async function cacheTrack(url: string): Promise<string> {
  const videoId = getYouTubeID(url);
  if (!videoId) throw new Error('Could not extract videoId');

  const cachePath = getCachePath(videoId);
  if (isCached(videoId)) return cachePath;

  const existingDownload = activeDownloads.get(videoId);
  if (existingDownload) {
    console.log(`[CACHE] Waiting for existing download of ${videoId}`);
    await existingDownload;
  } else {
    const promise = runYtDlpDownload(url)
      .catch((err) => {
        console.error(`[CACHE] Failed to cache ${videoId}:`, err.message);
        throw err;
      })
      .finally(() => activeDownloads.delete(videoId));

    activeDownloads.set(videoId, promise);
    await promise;
  }

  if (!fs.existsSync(cachePath)) {
    throw new Error(
      `[CACHE] Expected file missing after download: ${cachePath}`
    );
  }

  const now = new Date();
  try {
    fs.utimesSync(cachePath, now, now);
  } catch (err) {
    console.warn(`[CACHE] Failed to update mtime for ${videoId}:`, err);
  }

  cleanupCache().catch((err) => console.error('[CACHE] Cleanup error:', err));

  return cachePath;
}

async function cleanupCache() {
  try {
    const files = fs
      .readdirSync(CACHE_DIR)
      .map((name) => {
        const filePath = path.join(CACHE_DIR, name);
        const { size, mtimeMs } = fs.statSync(filePath);
        return { filePath, size, mtimeMs };
      })
      .sort((a, b) => a.mtimeMs - b.mtimeMs);

    let total = files.reduce((s, f) => s + f.size, 0);
    if (total <= MAX_CACHE_SIZE_BYTES) return;

    for (const f of files) {
      if (total <= MAX_CACHE_SIZE_BYTES) break;
      fs.unlink(f.filePath, (err) => {
        if (!err)
          console.log(`[CACHE] Removed old file: ${path.basename(f.filePath)}`);
      });
      total -= f.size;
    }
  } catch (err) {
    console.error('[CACHE] Cleanup error:', err);
  }
}

export async function prefetchNext(url: string) {
  const videoId = getYouTubeID(url);
  if (!videoId) {
    console.error('[CACHE] Invalid URL passed to prefetchNext:', url);
    return;
  }

  const cachePath = path.join(CACHE_DIR, `${videoId}.opus`);
  if (fs.existsSync(cachePath)) return;

  if (activeDownloads.has(videoId)) {
    console.log(`[CACHE] Prefetch for ${videoId} already in progress`);
    return;
  }

  console.log(`[CACHE] Prefetching ${videoId}`);

  const promise = runYtDlpDownload(url)
    .then(() => {
      console.log(`[CACHE] Prefetch finished: ${videoId}`);
      activeDownloads.delete(videoId);
    })
    .catch((err) => {
      console.error(`[CACHE] Prefetch failed for ${videoId}:`, err.message);
      activeDownloads.delete(videoId);
    });

  activeDownloads.set(videoId, promise);
}

async function runYtDlpDownload(url: string): Promise<void> {
  return ytdlpQueue.add(() => {
    return new Promise<void>((resolve, reject) => {
      const videoId = getYouTubeID(url);
      if (!videoId) return reject(new Error('Could not extract videoId'));

      const tmpPath = path.join(CACHE_DIR, `${videoId}.part.opus`);
      const finalPath = path.join(CACHE_DIR, `${videoId}.opus`);
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
        path.join(CACHE_DIR, '%(id)s.part.opus'),
        '--ffmpeg-location',
        '/usr/bin/ffmpeg',
        '--quiet',
        '--no-progress',
        url,
      ]);

      ytdlp.on('close', (code) => {
        if (code === 0) {
          try {
            if (fs.existsSync(tmpPath)) {
              fs.renameSync(tmpPath, finalPath);
              console.log(`[CACHE] Download complete: ${videoId}`);
            }
            for (const f of fs.readdirSync(CACHE_DIR)) {
              if (f.endsWith('.part.opus')) {
                const stale = path.join(CACHE_DIR, f);
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
