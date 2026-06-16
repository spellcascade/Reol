import { Message, VoiceBasedChannel } from 'discord.js';
import { ENV } from './ENV';

export function getTargetVoiceChannel(
  message: Message,
): VoiceBasedChannel | null {
  const memberVoiceChannel = message.member?.voice.channel;
  if (memberVoiceChannel) {
    return memberVoiceChannel;
  }

  const defaultChannel = message.guild?.channels.cache.get(
    ENV.VOICE_CHANNEL_ID,
  );

  return defaultChannel?.isVoiceBased() ? defaultChannel : null;
}
