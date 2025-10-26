import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import appRootPath from 'app-root-path';
import getYouTubeID from 'get-youtube-id';
import { ENV } from '../../ENV';

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

  console.log(`[CACHE] Caching new track: ${videoId}`);
  await new Promise<void>((resolve, reject) => {
    const ytdlp = spawnYtdlp(url);
    const ffmpeg = spawnFFmpeg(cachePath);

    ytdlp.stdout.pipe(ffmpeg.stdin);

    ffmpeg.on('close', (code) => {
      if (code === 0 && fs.existsSync(cachePath)) resolve();
      else reject(new Error(`Failed to cache ${videoId}`));
    });

    ffmpeg.on('error', reject);
    ytdlp.on('error', reject);
  });

  const now = new Date();
  fs.utimesSync(cachePath, now, now);

  cleanupCache();
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

let activePrefetch: ReturnType<typeof spawn> | null = null;
let activeUrl: string | null = null;

export function isPrefetching() {
  return !!activePrefetch;
}

export async function prefetchNext(url: string) {
  const videoId = getYouTubeID(url);
  const cachePath = path.join(CACHE_DIR, `${videoId}.opus`);
  if (fs.existsSync(cachePath)) {
    return;
  }

  if (activePrefetch) {
    console.log(`[CACHE] Skipping prefetch — already fetching ${activeUrl}`);
    return;
  }
  console.log(`[CACHE] Prefetching ${videoId}`);

  const ytdlp = spawnYtdlp(url);
  const ffmpeg = spawnFFmpeg(cachePath);

  activePrefetch = ffmpeg;
  activeUrl = url;

  ytdlp.stdout.pipe(ffmpeg.stdin);

  ffmpeg.on('close', (code) => {
    if (code === 0) console.log(`[CACHE] Prefetch finished: ${videoId}`);
    else console.log(`[CACHE] Prefetch failed or canceled: ${videoId}`);
    activePrefetch = null;
    activeUrl = null;
  });

  ffmpeg.on('error', () => {
    activePrefetch = null;
    activeUrl = null;
  });
}

function spawnYtdlp(url: string) {
  const cookiesPath = `${appRootPath}/cookies.txt`;

  return spawn('yt-dlp', [
    '--ffmpeg-location',
    '/usr/bin/ffmpeg',
    '--cookies',
    cookiesPath,
    '-f',
    'bestaudio[acodec=opus]/bestaudio',
    '-o',
    '-',
    '--quiet',
    url,
  ]);
}

function spawnFFmpeg(cachePath: string) {
  return spawn('ffmpeg', [
    '-i',
    'pipe:0',
    '-vn',
    '-c:a',
    'libopus',
    '-b:a',
    '128k',
    '-ar',
    '48000',
    '-ac',
    '2',
    cachePath,
  ]);
}
