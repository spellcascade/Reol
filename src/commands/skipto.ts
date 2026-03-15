import { Command } from '../interfaces/Command';

export default {
  name: 'skipto',
  aliases: ['st'],
  description: 'Skip to a specific track in the queue',
  execute: async (client, message, args) => {
    try {
      const guildId = message.guildId;
      if (!guildId) throw new GuildNotFoundError();

      const skipTo = Number(args?.[0]);
      if (isNaN(skipTo) || skipTo <= 1) {
        return message.channel.send('Please provide a valid number.');
      }

      const queue = client.queues.get(guildId);
      if (!queue) {
        return message.channel.send('There is no queue.');
      }

      if (skipTo > queue.tracks.length) {
        return message.channel.send(`There is no track at position ${skipTo}.`);
      }

      queue.tracks.splice(0, skipTo - 2);
      queue.player.stop(true);
    } catch (error) {
      console.log(error);

      message.reply('There was an error executing the command.');
    }
  },
} as Command;
