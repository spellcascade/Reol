import { EmbedBuilder } from 'discord.js';
import humanizeDuration from 'humanize-duration';
import { Command } from '../interfaces/Command';
import { ENV } from '../utils/ENV';
import { DEFAULT_COLOR, DEFAULT_THUMBNAIL } from '../utils/helpers';

export default {
  name: 'queue',
  aliases: ['q'],
  description: 'Show the queue',
  async execute(client, message, args) {
    try {
      const guildId = message.guildId;
      if (!guildId) throw new GuildNotFoundError();

      const queue = client.queues.get(guildId);
      if (!queue || !queue.items.length) {
        return message.channel.send('There is no queue.');
      }

      const tracks = queue.items.map((item) => item.track);

      const PAGE_SIZE = 10;
      const pages = Math.ceil(tracks.length / PAGE_SIZE);
      const page = args?.[0] ? parseInt(args[0]) : 1;

      if (page > pages) {
        return message.reply(`Page ${page} does not exist.`);
      }

      const totalDurationSec = tracks.reduce(
        (acc, track) => acc + track.durationSec,
        0
      );
      const queueDuration = humanizeDuration(totalDurationSec * 1000, {
        round: true,
      });

      const queueEmbed = new EmbedBuilder();
      queueEmbed
        .setDescription(`${tracks.length} tracks, ${queueDuration}`)
        .setThumbnail(DEFAULT_THUMBNAIL)
        .setColor(DEFAULT_COLOR);

      tracks
        .slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
        .forEach((track, idx) => {
          queueEmbed.addFields({
            name: `${idx + PAGE_SIZE * (page - 1) + 1}. ${track.title}`,
            value:
              `Duration: ${track.durationFormatted}` +
              (track.requestedBy ? ` by ${track.requestedBy}` : ''),
          });
        });

      if (pages > 1) {
        queueEmbed
          .setAuthor({
            name: `Page ${page} of ${pages}`,
          })
          .setFooter({
            text: `${ENV.PREFIX}queue <page> to view a specific page`,
          });
      }

      return message.channel.send({ embeds: [queueEmbed] });
    } catch (error) {
      console.log(error);

      message.reply('There was an error executing the command.');
    }
  },
} as Command;
