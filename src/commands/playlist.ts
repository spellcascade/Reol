import {
  DiscordGatewayAdapterCreator,
  joinVoiceChannel,
} from '@discordjs/voice';
import { EmbedBuilder, TextChannel, VoiceBasedChannel } from 'discord.js';
import { Command } from '../interfaces/Command';
import { Queue } from '../interfaces/Queue';
import { ENV } from '../utils/ENV';
import { getPlaylist } from '../utils/getPlaylist';
import { DEFAULT_COLOR } from '../utils/helpers';
import { truncateLongDescription } from '../utils/truncateDescription';

export default {
  name: 'playlist',
  description: 'Play a playlist from youtube or spotify',
  aliases: ['pl'],
  async execute(client, message, args) {
    try {
      if (!args?.length) {
        return message.channel.send('Please provide a playlist link');
      }

      const playlistLink = args[0];

      const voiceChannel =
        message.member?.voice.channel ||
        (client.channels.cache.get(ENV.VOICE_CHANNEL_ID) as VoiceBasedChannel);

      if (!voiceChannel) {
        return message.reply(
          'Please join a voice channel or set a voice channel in the .env file.',
        );
      }

      const guildId = message.guildId;
      if (!guildId) throw new GuildNotFoundError();

      const playlist = await getPlaylist(playlistLink);
      const tracks = playlist.tracks.map((track) => ({
        ...track,
        requestedBy: message.author.displayName,
      }));

      const queue = client.queues.get(guildId);
      if (queue) {
        queue.enqueue(...tracks);
      } else {
        const newQueue = new Queue({
          message,
          textChannel: message.channel as TextChannel,
          connection: joinVoiceChannel({
            channelId: voiceChannel.id,
            guildId,
            adapterCreator: voiceChannel.guild
              .voiceAdapterCreator as DiscordGatewayAdapterCreator,
            selfDeaf: false,
          }),
        });

        client.queues.set(guildId, newQueue);
        newQueue.enqueue(...tracks);
      }

      const description = tracks
        .map((song, idx) => `${idx + 1}. ${song.title}`)
        .join('\n');
      const embedDescription = truncateLongDescription(description);

      const playlistEmbed = new EmbedBuilder()
        .setTitle(`${playlist.title}`)
        .setDescription(embedDescription)
        .setURL(playlist.url)
        .setColor(DEFAULT_COLOR);

      return message.channel.send({
        embeds: [playlistEmbed],
      });
    } catch (error: any) {
      console.error(error);

      return message.channel.send(error.message || 'Mixes are not supported');
    }
  },
} as Command;
