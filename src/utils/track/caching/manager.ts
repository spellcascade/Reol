import fs from 'fs';
import path from 'path';
import appRootPath from 'app-root-path';
import getYouTubeID from 'get-youtube-id';
import { Track } from '../../../interfaces/Track';
import { cleanupCache } from './cleaup';
import { runYtDlpDownload } from './downloader';

const activeDownloads = new Map<string, Promise<void>>();

const CACHE_DIR = path.join(appRootPath.path, 'cache');

if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });

export function getCachePath(videoId: string) {
  return path.join(CACHE_DIR, `${videoId}.opus`);
}

export function isCached(videoId: string) {
  return fs.existsSync(getCachePath(videoId));
}

export async function cacheTrack(track: Track): Promise<string | null> {
  const videoId = getYouTubeID(track.url);
  if (!videoId) {
    console.error('[CACHE] Could not extract videoId');
    return null;
  }

  const cachePath = getCachePath(videoId);
  if (isCached(videoId)) return cachePath;

  try {
    const existingDownload = activeDownloads.get(videoId);
    if (existingDownload) {
      console.log(`[CACHE] Waiting for existing download of ${videoId}`);
      await existingDownload;
    } else {
      const promise = runYtDlpDownload(track.url, track.durationSec, CACHE_DIR)
        .catch((err) => {
          console.error(`[CACHE] Failed to cache ${videoId}:`, err.message);
          throw err;
        })
        .finally(() => activeDownloads.delete(videoId));

      activeDownloads.set(videoId, promise);
      await promise;
    }

    if (!fs.existsSync(cachePath)) {
      console.warn(
        `[CACHE] Expected file missing after download: ${cachePath}`
      );
      return null;
    }

    const now = new Date();
    try {
      fs.utimesSync(cachePath, now, now);
    } catch (err) {
      console.warn(`[CACHE] Failed to update mtime for ${videoId}:`, err);
    }

    cleanupCache(CACHE_DIR).catch((err) =>
      console.error('[CACHE] Cleanup error:', err)
    );

    return cachePath;
  } catch (err) {
    console.error(`[CACHE] Cache failed for ${videoId}:`, err);
    return null;
  }
}
