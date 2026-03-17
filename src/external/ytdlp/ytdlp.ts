import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { promisify } from 'util';
import type { ReadStream } from 'fs';
import getYouTubeID from 'get-youtube-id';

const rename = promisify(fs.rename);
const stat = promisify(fs.stat);
const unlink = promisify(fs.unlink);
const utimes = promisify(fs.utimes);

const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const MIN_FILE_SIZE_BYTES = 16 * 1024;

interface GetStreamResult {
  stream: ReadStream;
  path: string;
  close(): void;
}

interface YtDlpOptions {
  cookiesPath?: string;
  cacheDir: string;
}

interface ProbeResult {
  durationSec: number | null;
}

export type YtDlpErrorKind =
  | 'bad_url'
  | 'blocked'
  | 'premium'
  | 'rate_limited'
  | 'unavailable'
  | 'private'
  | 'age_restricted'
  | 'format'
  | 'network'
  | 'invalid_file'
  | 'unknown';

interface YtDlpErrorOptions {
  kind: YtDlpErrorKind;
  code?: number | null;
  userMessage?: string;
}

export class YtDlpError extends Error {
  public readonly kind: YtDlpErrorKind;
  public readonly code: number | null;
  public userMessage?: string;

  constructor(message: string, options: YtDlpErrorOptions) {
    super(message);
    this.name = 'YtDlpError';
    this.kind = options.kind;
    this.code = options.code ?? null;
    this.userMessage = options.userMessage;
  }
}

export class YtDlp {
  private readonly cookiesPath?: string;
  private readonly cacheDir: string;

  constructor(options: YtDlpOptions) {
    this.cookiesPath = options.cookiesPath;
    this.cacheDir = options.cacheDir;
  }

  public async getStream(
    url: string,
    expectedDurationSec?: number,
  ): Promise<GetStreamResult> {
    await this.cleanupExpiredCache();

    const videoId = getYouTubeID(url);
    if (!videoId) {
      throw new YtDlpError('Failed to extract YouTube ID', {
        kind: 'bad_url',
      });
    }

    const cachedPath = await this.findCachedFile(videoId);
    if (cachedPath) {
      await this.touchFile(cachedPath);
      await this.validateFile(cachedPath, expectedDurationSec);

      return this.createFileStreamResult(cachedPath);
    }

    const tmpBase = path.join(
      this.cacheDir,
      `${videoId}.${Date.now()}.${process.pid}.tmp`,
    );
    const outputTemplate = `${tmpBase}.%(ext)s`;

    await this.download(url, outputTemplate);

    const downloadedPath = await this.findDownloadedTempFile(tmpBase);
    if (!downloadedPath) {
      throw new YtDlpError('yt-dlp finished but no downloaded file was found', {
        kind: 'invalid_file',
      });
    }

    try {
      await this.validateFile(downloadedPath, expectedDurationSec);

      const finalPath = path.join(
        this.cacheDir,
        path
          .basename(downloadedPath)
          .replace(
            new RegExp(`^${this.escapeRegExp(path.basename(tmpBase))}\\.`),
            `${videoId}.`,
          ),
      );

      await rename(downloadedPath, finalPath);

      return this.createFileStreamResult(finalPath);
    } catch (error) {
      await this.safeUnlink(downloadedPath);
      throw error;
    }
  }

  private async download(url: string, outputTemplate: string): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      const args = [
        '-4',
        '-v',
        '--extractor-args',
        'youtube:player_client=web',
        '--no-cache-dir',
        '--ignore-config',
        '--no-playlist',
        '--newline',
        '--format',
        'bestaudio[acodec=opus][ext=webm]/bestaudio[acodec=opus]/bestaudio[ext=webm]/bestaudio[ext=m4a]/bestaudio/best',
        '--concurrent-fragments',
        '4',
        '--fragment-retries',
        '10',
        '--retry-sleep',
        '0.5',
        ...(this.cookiesPath ? ['--cookies', this.cookiesPath] : []),
        '-o',
        outputTemplate,
        url,
      ];

      log('starting download', url);

      const proc = spawn('yt-dlp', args, {
        stdio: ['ignore', 'ignore', 'pipe'],
      });

      log(`command: ${proc.spawnargs.join(' ')}`);

      let stderrBuffer = '';
      const stderrLines: string[] = [];

      proc.stderr?.on('data', (chunk: Buffer | string) => {
        stderrBuffer += chunk.toString();

        const lines = stderrBuffer.split('\n');
        stderrBuffer = lines.pop() ?? '';

        for (const line of lines) {
          const cleaned = line.trimEnd();
          if (!cleaned) {
            continue;
          }

          stderrLines.push(cleaned);

          if (stderrLines.length > 300) {
            stderrLines.shift();
          }

          log(cleaned);
        }
      });

      proc.once('error', (error) => {
        reject(
          new YtDlpError(`Failed to start yt-dlp: ${error.message}`, {
            kind: 'network',
          }),
        );
      });

      proc.once('close', (code, signal) => {
        const cleaned = stderrBuffer.trimEnd();
        if (cleaned) {
          stderrLines.push(cleaned);

          if (stderrLines.length > 300) {
            stderrLines.shift();
          }

          log(cleaned);
        }

        if (code === 0) {
          log('finished successfully');
          resolve();
          return;
        }

        reject(
          this.createDownloadError(
            stderrLines,
            code,
            `yt-dlp exited with code ${code ?? 'null'}${signal ? `, signal ${signal}` : ''}`,
          ),
        );
      });
    });
  }

  private async validateFile(
    filePath: string,
    expectedDurationSec?: number,
  ): Promise<void> {
    const fileStat = await stat(filePath);

    if (!fileStat.isFile()) {
      throw new YtDlpError('Downloaded path is not a file', {
        kind: 'invalid_file',
      });
    }

    if (fileStat.size < MIN_FILE_SIZE_BYTES) {
      throw new YtDlpError(
        `Downloaded file is too small: ${fileStat.size} bytes`,
        { kind: 'invalid_file' },
      );
    }

    const probe = await this.probeFile(filePath);

    if (
      expectedDurationSec != null &&
      probe.durationSec != null &&
      !this.isDurationValid(probe.durationSec, expectedDurationSec)
    ) {
      const allowedShortfallSec = Math.min(3, expectedDurationSec * 0.05);
      const shortfallSec = expectedDurationSec - probe.durationSec;

      throw new YtDlpError(
        `Audio is too short. Expected ${expectedDurationSec}s, got ${probe.durationSec.toFixed(2)}s (${shortfallSec.toFixed(2)}s short; allowed ${allowedShortfallSec.toFixed(2)}s)`,
        { kind: 'invalid_file' },
      );
    }
  }

  private async probeFile(filePath: string): Promise<ProbeResult> {
    return new Promise<ProbeResult>((resolve, reject) => {
      const args = [
        '-v',
        'error',
        '-show_entries',
        'format=duration',
        '-of',
        'default=noprint_wrappers=1:nokey=1',
        filePath,
      ];

      const proc = spawn('ffprobe', args, {
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';

      proc.stdout.on('data', (chunk: Buffer | string) => {
        stdout += chunk.toString();
      });

      proc.stderr.on('data', (chunk: Buffer | string) => {
        stderr += chunk.toString();
      });

      proc.once('error', (error) => {
        reject(
          new YtDlpError(`ffprobe failed: ${error.message}`, {
            kind: 'invalid_file',
          }),
        );
      });

      proc.once('close', (code) => {
        if (code !== 0) {
          reject(
            new YtDlpError(
              `ffprobe exited with code ${code}: ${stderr.trim()}`,
              { kind: 'invalid_file' },
            ),
          );
          return;
        }

        const parsed = Number.parseFloat(stdout.trim());

        resolve({
          durationSec: Number.isFinite(parsed) ? parsed : null,
        });
      });
    });
  }

  private async findCachedFile(videoId: string): Promise<string | null> {
    const files = await fs.promises.readdir(this.cacheDir);
    const match = files.find((file) => file.startsWith(`${videoId}.`));

    return match ? path.join(this.cacheDir, match) : null;
  }

  private async findDownloadedTempFile(
    tmpBase: string,
  ): Promise<string | null> {
    const dir = path.dirname(tmpBase);
    const prefix = `${path.basename(tmpBase)}.`;
    const files = await fs.promises.readdir(dir);
    const match = files.find((file) => file.startsWith(prefix));

    return match ? path.join(dir, match) : null;
  }

  private createFileStreamResult(filePath: string): GetStreamResult {
    const stream = fs.createReadStream(filePath);

    return {
      stream,
      path: filePath,
      close() {
        stream.destroy();
      },
    };
  }

  private async cleanupExpiredCache(): Promise<void> {
    const files = await fs.promises.readdir(this.cacheDir);
    const now = Date.now();

    await Promise.all(
      files.map(async (file) => {
        const filePath = path.join(this.cacheDir, file);

        try {
          const fileStat = await stat(filePath);
          if (!fileStat.isFile()) {
            return;
          }

          const ageMs = now - fileStat.mtimeMs;
          if (ageMs <= CACHE_TTL_MS) {
            return;
          }

          await unlink(filePath);
          log('deleted expired cache file', { file });
        } catch (error) {
          log('failed to clean cache file', {
            file,
            error,
          });
        }
      }),
    );
  }

  private async touchFile(filePath: string): Promise<void> {
    const now = new Date();
    await utimes(filePath, now, now);
  }

  private async safeUnlink(filePath: string): Promise<void> {
    try {
      await unlink(filePath);
    } catch {
      // ignore
    }
  }

  private escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  private isDurationValid(
    actualDurationSec: number,
    expectedDurationSec: number,
  ): boolean {
    const allowedShortfallSec = Math.min(3, expectedDurationSec * 0.05);
    const shortfallSec = expectedDurationSec - actualDurationSec;

    return shortfallSec <= allowedShortfallSec;
  }

  private createDownloadError(
    stderrLines: string[],
    code: number | null,
    fallbackMessage: string,
  ): YtDlpError {
    const text = stderrLines.join('\n').toLowerCase();

    if (text.includes('http error 403') || text.includes('forbidden')) {
      return new YtDlpError('YouTube temporarily blocked the download', {
        kind: 'blocked',
        code,
      });
    }

    if (
      text.includes('this video is only available to music premium members')
    ) {
      return new YtDlpError('Premium video', {
        kind: 'premium',
        code,
      });
    }

    if (text.includes('http error 429') || text.includes('too many requests')) {
      return new YtDlpError('YouTube rate limited the download', {
        kind: 'rate_limited',
        code,
      });
    }

    if (text.includes('private video')) {
      return new YtDlpError('This video is private', {
        kind: 'private',
        code,
      });
    }

    if (
      text.includes('sign in to confirm your age') ||
      text.includes('age-restricted') ||
      text.includes('age restricted')
    ) {
      return new YtDlpError('This video is age restricted', {
        kind: 'age_restricted',
        code,
      });
    }

    if (text.includes('video unavailable')) {
      return new YtDlpError('This video is unavailable', {
        kind: 'unavailable',
        code,
      });
    }

    if (
      text.includes('requested format is not available') ||
      text.includes('no video formats found') ||
      text.includes('unable to extract')
    ) {
      return new YtDlpError('Could not extract audio from this video', {
        kind: 'format',
        code,
      });
    }

    if (
      text.includes('timed out') ||
      text.includes('connection reset') ||
      text.includes('temporarily unavailable') ||
      text.includes('network is unreachable') ||
      text.includes('unable to download webpage')
    ) {
      return new YtDlpError('Network error while loading the track', {
        kind: 'network',
        code,
      });
    }

    return new YtDlpError(fallbackMessage, {
      kind: 'unknown',
      code,
    });
  }
}

function log(message: string, ...args: unknown[]) {
  console.log(`[${new Date().toLocaleString()}] [yt-dlp] ${message}`, ...args);
}
