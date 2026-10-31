import { Command } from '../interfaces/Command';
import { AppDataSource } from '../db';
import { SongRequest } from '../db/entities/SongRequest';
import { EmbedBuilder } from 'discord.js';
import { DEFAULT_COLOR } from '../utils/helpers';
import { ENV } from '../utils/ENV';

export default {
  name: 'top',
  description: 'List the top requested songs',
  async execute(_, message, args) {
    try {
      if (!ENV.USE_DB) {
        return message.reply('Song requests recording is not enabled');
      }

      const requestedPage = args?.[0] ? Number(args[0]) : 1;
      const guildId = message.guildId;

      const repo = AppDataSource.getRepository(SongRequest);
      const rows: Array<{
        url: string;
        normalizedTitle: string;
      }> = await repo
        .createQueryBuilder('song_request')
        .select([
          'song_request.url AS url',
          'song_request.normalizedTitle AS normalizedTitle',
        ])
        .where('song_request.guildId = :guildId', { guildId })
        .orderBy('song_request.requestedAt', 'DESC')
        .getRawMany();

      const groupedRequests = new Map<
        string,
        { label: string; url: string; count: number }
      >();

      for (const row of rows) {
        const label = row.normalizedTitle.trim();
        const key = label.toLocaleLowerCase();
        const existing = groupedRequests.get(key);

        if (existing) {
          existing.count += 1;
          continue;
        }

        groupedRequests.set(key, {
          label,
          url: row.url,
          count: 1,
        });
      }

      const requests = [...groupedRequests.values()].sort((left, right) => {
        if (right.count !== left.count) {
          return right.count - left.count;
        }

        return left.label.localeCompare(right.label);
      });

      if (!requests.length) {
        return message.reply('No songs requested yet');
      }

      if (!Number.isInteger(requestedPage) || requestedPage < 1) {
        return message.reply('Page must be a positive number');
      }

      const MAX_LENGTH = 4000;
      const pages: string[] = [];
      let description = '';

      for (let i = 0; i < requests.length; i++) {
        const request = requests[i];
        const entry = `${i + 1}. [${request.label}](${request.url}) - ${
          request.count
        } plays\n`;

        if (
          description.length > 0 &&
          description.length + entry.length > MAX_LENGTH
        ) {
          pages.push(description);
          description = '';
        }

        description += entry;
      }

      if (description.length) {
        pages.push(description);
      }

      if (requestedPage > pages.length) {
        return message.reply(
          pages.length === 1
            ? 'There is only 1 page'
            : `Page ${requestedPage} does not exist. There are ${pages.length} pages.`,
        );
      }

      const embed = new EmbedBuilder()
        .setTitle('Top requested songs')
        .setDescription(pages[requestedPage - 1])
        .setColor(DEFAULT_COLOR);

      if (pages.length > 1) {
        embed
          .setAuthor({ name: `Page ${requestedPage} of ${pages.length}` })
          .setFooter({
            text: `${ENV.PREFIX}top <page> to view a specific page`,
          });
      }

      message.channel.send({
        embeds: [embed],
      });
    } catch (error: any) {
      console.error(error);

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
