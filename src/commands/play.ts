import { TextChannel } from 'discord.js';
import { Queue } from '../interfaces/Queue';
import {
  DiscordGatewayAdapterCreator,
  joinVoiceChannel,
} from '@discordjs/voice';
import { ENV } from '../utils/ENV';
import { Command } from '../interfaces/Command';
import { getTrack } from '../utils/getTrack';
import { isPlaylist } from '../utils/helpers';
import { saveSongRequestForTrack } from '../db/methods/saveSongRequestForTrack';
import {
  isTrackLoadHandled,
  loadTrackResource,
} from '../utils/track/loadTrackResource';
import { getTargetVoiceChannel } from '../utils/getVoiceChannel';

export default {
  name: 'play',
  description: 'Play a song from YouTube or Spotify',
  aliases: ['p'],
  async execute(client, message, args) {
    try {
      if (!args?.length) {
        return message.reply('Please provide a search query or link');
      }

      if (isPlaylist(args[0])) {
        return client.commands
          .get('playlist')
          .execute(client, message, [args[0]]);
      }

      if (!message.channel) {
        return message.reply('Channel not found');
      }

      const guildId = message.guildId;
      if (!guildId) throw new GuildNotFoundError();

      const voiceChannel = getTargetVoiceChannel(message);
      if (!voiceChannel) {
        return message.reply('Please join a voice channel.');
      }

      const query = args.join(' ');
      const track = await getTrack(query);
      track.requestedBy = message.author.displayName;

      if (ENV.USE_DB) {
        void saveSongRequestForTrack({
          track,
          authorId: message.author.id,
          guildId,
        }).catch((error) => {
          console.error('Failed to save song request', error);
        });
      }

      const queue = client.queues.get(guildId);
      if (queue) {
        queue.enqueue(track);

        if (queue.tracks.length > 1) {
          message.channel.send(`Added to queue: **${track.title}**`);
        }

        return;
      }

      const pendingQueue = client.pendingQueues.get(guildId);
      if (pendingQueue) {
        try {
          const queue = await pendingQueue;
          queue.enqueue(track);

          if (queue.tracks.length > 1) {
            message.channel.send(`Added to queue: **${track.title}**`);
          }

          return;
        } catch {}
      }

      const queuePromise = (async () => {
        const resource = await loadTrackResource(
          message.channel as TextChannel,
          track,
        );

        const newQueue = new Queue({
          initialResource: resource,
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
        newQueue.enqueue(track);
        return newQueue;
      })();

      client.pendingQueues.set(guildId, queuePromise);

      try {
        await queuePromise;
      } finally {
        if (client.pendingQueues.get(guildId) === queuePromise) {
          client.pendingQueues.delete(guildId);
        }
      }
    } catch (error: any) {
      console.error(error);

      if (isTrackLoadHandled(error)) {
        return;
      }

      if (error instanceof Error) {
        return message.reply(error.message);
      }

      if (typeof error === 'string') {
        return message.reply(error);
      } else {
        return message.reply('Something went wrong');
      }
    }
  },
} as Command;
