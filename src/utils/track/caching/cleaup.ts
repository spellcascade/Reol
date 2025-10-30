import fs from 'fs';
import path from 'path';
import { ENV } from '../../ENV';

const MAX_CACHE_SIZE_BYTES = ENV.MAX_CACHE_SIZE_GB * 1024 ** 3;

export async function cleanupCache(dir: string) {
  try {
    const files = await fs.promises.readdir(dir);
    const fileStats = await Promise.all(
      files.map(async (name) => {
        const filePath = path.join(dir, name);
        const { size, mtimeMs } = await fs.promises.stat(filePath);
        return { filePath, size, mtimeMs };
      })
    );

    fileStats.sort((a, b) => a.mtimeMs - b.mtimeMs);
    let total = fileStats.reduce((s, f) => s + f.size, 0);

    for (const f of fileStats) {
      if (total <= MAX_CACHE_SIZE_BYTES) break;
      await fs.promises.unlink(f.filePath).catch(() => {});
      total -= f.size;
      console.log(`[CACHE] Removed old file: ${path.basename(f.filePath)}`);
    }
  } catch (err) {
    console.error('[CACHE] Cleanup error:', err);
  }
}
