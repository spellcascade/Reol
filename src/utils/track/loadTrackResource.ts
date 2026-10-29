import { AudioResource } from '@discordjs/voice';
import { TextChannel } from 'discord.js';
import { YtDlpError } from '../../external/ytdlp/ytdlp';
import { Track } from '../../interfaces/Track';
import { createResource } from './createResource';

interface HandledTrackLoadError {
  trackLoadHandled?: boolean;
}

export async function loadTrackResource(
  textChannel: TextChannel,
  track: Track,
): Promise<AudioResource> {
  // Do not block resource creation on the Discord REST call. The loading
  // message is only informational, and the extra round-trip widens the gap
  // between tracks, which is what makes Discord re-clock the audio.
  const messagePromise = textChannel
    .send('**Loading track...**')
    .catch(() => null);

  try {
    const resource = await createResource(track.url, track.durationSec);

    void messagePromise.then((message) => {
      message?.delete().catch(() => {});
    });

    return resource;
  } catch (error) {
    const userMessage =
      error instanceof YtDlpError
        ? (error.userMessage ?? 'Cannot load track.')
        : 'Cannot load track.';

    const message = await messagePromise;
    await message?.edit(`**${userMessage}**`);

    markTrackLoadHandled(error);
    throw error;
  }
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
