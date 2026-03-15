import { Command } from '../interfaces/Command';
import { AudioPlayerStatus } from '@discordjs/voice';

export default {
  name: 'skip',
  description: 'Skip the current track',
  async execute(client, message) {
    try {
      const guildId = message.guildId;
      if (!guildId) throw new GuildNotFoundError();

      const queue = client.queues.get(guildId);
      if (!queue) {
        return message.channel.send('There is no queue.');
      }

      if (!queue.tracks.length) {
        return message.channel.send('Nothing is currently playing.');
      }

      if (queue.player.state.status === AudioPlayerStatus.Idle) {
        return message.channel.send('Nothing is currently playing.');
      }

      queue.player.stop(true);
    } catch (error) {
      console.log(error);

      message.reply('There was an error executing the command.');
    }
  },
} as Command;
