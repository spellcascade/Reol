import { execFile } from 'child_process';
import { promisify } from 'util';
const execFileAsync = promisify(execFile);

export async function isOpusDurationValid(
  filePath: string,
  expectedDurationSec: number
): Promise<boolean> {
  const actual = await getOpusDuration(filePath);
  if (actual == null || !Number.isFinite(actual) || actual <= 0) return false;

  const maxShortfall = Math.min(3, expectedDurationSec * 0.05);
  const shortfall = expectedDurationSec - actual;

  const isValid = shortfall <= maxShortfall;

  if (!isValid) {
    console.warn(
      `[CACHE] Incomplete opus: expected ${expectedDurationSec}s, got ${actual.toFixed(
        2
      )}s (${shortfall.toFixed(2)}s shorter; allowed ${maxShortfall}s)`
    );
  }

  return isValid;
}

async function getOpusDuration(filePath: string): Promise<number | null> {
  try {
    const { stdout } = await execFileAsync('ffprobe', [
      '-v',
      'error',
      '-show_entries',
      'format=duration',
      '-of',
      'default=noprint_wrappers=1:nokey=1',
      filePath,
    ]);
    const duration = parseFloat(stdout.trim());
    return isNaN(duration) ? null : duration;
  } catch {
    return null;
  }
}
