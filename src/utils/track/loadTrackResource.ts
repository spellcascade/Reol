import { AudioResource } from '@discordjs/voice';
import { TextChannel } from 'discord.js';
import { YtDlpError } from '../../external/ytdlp/ytdlp';
import { Track } from '../../interfaces/Track';
import { createResource, ensureResourceCached } from './createResource';

interface HandledTrackLoadError {
  trackLoadHandled?: boolean;
}

export async function loadTrackResource(
  textChannel: TextChannel,
  track: Track,
): Promise<AudioResource> {
  const message = await textChannel.send('**Loading track...**');
  let success = false;

  try {
    const resource = await createResource(track.url, track.durationSec);
    success = true;
    return resource;
  } catch (error) {
    const userMessage =
      error instanceof YtDlpError
        ? (error.userMessage ?? 'Cannot load track.')
        : 'Cannot load track.';

    await message.edit(`**${userMessage}**`);
    markTrackLoadHandled(error);
    throw error;
  } finally {
    if (success) {
      message.delete().catch(() => {});
    }
  }
}

export async function precacheTrackResource(track: Track): Promise<void> {
  await ensureResourceCached(track.url, track.durationSec);
}

export function isTrackLoadHandled(error: unknown): boolean {
  return Boolean(
    error &&
      typeof error === 'object' &&
      (error as HandledTrackLoadError).trackLoadHandled,
  );
}

function markTrackLoadHandled(error: unknown) {
  if (!error || typeof error !== 'object') return;

  (error as HandledTrackLoadError).trackLoadHandled = true;
}
