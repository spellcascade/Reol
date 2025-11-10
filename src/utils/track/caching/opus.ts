import { execFile } from 'child_process';
import { promisify } from 'util';
const execFileAsync = promisify(execFile);

export async function isOpusDurationValid(
  filePath: string,
  expectedDurationSec: number
): Promise<boolean> {
  const actual = await getOpusDuration(filePath);
  if (!actual) return false;

  const diff = Math.abs(actual - expectedDurationSec);
  const tolerance = Math.min(3, expectedDurationSec * 0.05);

  console.log(
    `Comparing ${actual} (opus) with ${expectedDurationSec} (expected) for: ${filePath}`
  );

  const isValid = diff <= tolerance && actual >= expectedDurationSec * 0.9;

  if (!isValid) {
    console.warn(
      `[CACHE] Incomplete opus: expected ${expectedDurationSec}s, got ${actual.toFixed(
        2
      )}s (${(expectedDurationSec - actual).toFixed(1)}s shorter)`
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
