import { Command } from '../interfaces/Command';

export default {
  name: 'remove',
  aliases: ['rm'],
  description: 'Remove a song from the queue',
  execute: async (client, message, args) => {
    const guildId = message.guildId;
    if (!guildId) throw new GuildNotFoundError();

    const queue = client.queues.get(guildId);
    if (!queue || !queue.tracks.length) {
      return message.channel.send('There is no queue.');
    }

    const ids = (args || []).map((arg) => parseInt(arg)) as number[];
    const indices = ids.map((id) => id - 1).sort((a, b) => b - a); // Convert to 0-based and sort in descending order to prevent index shift issues when removing multiple items, and then removes each specified track from the queue.

    for (const index of indices) {
      const title = queue.tracks[index]?.title || index.toString();

      if (index === 0) {
        queue.player.stop(true);
        await message.channel.send(`Removed track **${title}**.`);

        continue;
      }

      if (index >= 0 && index < queue.tracks.length) {
        queue.tracks.splice(index, 1);

        await message.channel.send(`Removed track **${title}**.`);
      } else {
        return message.reply('Invalid track number(s).');
      }
    }

    if (queue.tracks.length === 0) {
      queue.player.stop(true);
    }
  },
} as Command;
