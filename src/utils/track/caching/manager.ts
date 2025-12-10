import fs from 'fs';
import path from 'path';
import appRootPath from 'app-root-path';
import getYouTubeID from 'get-youtube-id';
import { Track } from '../../../interfaces/Track';
import { cleanupCache } from './cleaup';
import { runYtDlpDownload } from './downloader';

const CACHE_DIR = path.join(appRootPath.path, 'cache');
if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });

const activeDownloads = new Map<string, Promise<void>>();

export async function cacheTrack(track: Track): Promise<string | null> {
  const videoId = getYouTubeID(track.url);
  if (!videoId) {
    console.error('[CACHE] Could not extract videoId');
    return null;
  }

  const cachePath = getCachePath(videoId);
  const isCached = await isOpusCached(videoId);
  if (isCached) return cachePath;

  try {
    const existingDownload = activeDownloads.get(videoId);
    if (existingDownload) {
      console.log(`[CACHE] Waiting for existing download of ${videoId}`);
      await existingDownload;
    } else {
      const promise = runYtDlpDownload(track.url, track.durationSec, CACHE_DIR)
        .catch((err) => {
          console.error(`[CACHE] Failed to cache ${videoId}:`, err);
          throw err;
        })
        .finally(() => activeDownloads.delete(videoId));

      activeDownloads.set(videoId, promise);
      await promise;
    }

    try {
      await fs.promises.access(cachePath, fs.constants.R_OK);
    } catch {
      console.warn(
        `[CACHE] Expected file missing after download: ${cachePath}`
      );
      return null;
    }

    try {
      const now = new Date();
      await fs.promises.utimes(cachePath, now, now);
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

export function getCachePath(videoId: string) {
  return path.join(CACHE_DIR, `${videoId}.opus`);
}

export async function isOpusCached(videoId: string): Promise<boolean> {
  try {
    await fs.promises.access(getCachePath(videoId), fs.constants.R_OK);
    return true;
  } catch {
    return false;
  }
}
