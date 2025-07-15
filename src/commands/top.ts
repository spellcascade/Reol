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
    if (!ENV.USE_DB) {
      return message.reply('Song requests recording is not enabled');
    }

    const count = Number(args?.[0]) || 20;
    const guildId = message.guildId;

    const repo = AppDataSource.getRepository(SongRequest);
    const requests: Array<{
      artist: string;
      name: string;
      url: string;
      count: number;
    }> = await repo
      .createQueryBuilder('song_request')
      .select([
        'song_request.artist AS artist',
        'song_request.name AS name',
        'url',
        'COUNT(*) AS count',
      ])
      .where('song_request.guildId = :guildId', { guildId })
      .andWhere("song_request.artist != ''")
      .andWhere("song_request.name != ''")
      .groupBy('song_request.artist')
      .addGroupBy('song_request.name')
      .orderBy('COUNT(*)', 'DESC')
      .take(count)
      .getRawMany();

    if (!requests.length) {
      return message.reply('No songs requested yet');
    }

    const MAX_LENGTH = 4096;
    let totalLength = 0;
    let description = '';
    let shownCount = 0;

    for (let i = 0; i < requests.length; i++) {
      const request = requests[i];
      const entry = `${i + 1}. [${request.artist} - ${request.name}](${
        request.url
      }) - ${request.count} plays`;

      const nextTotal = totalLength + entry.length;
      const remaining = requests.length - (i + 1);
      const andMoreText = `...and ${remaining} more`;

      if (remaining > 0 && nextTotal + andMoreText.length > MAX_LENGTH) {
        break;
      }

      description += entry + '\n';
      totalLength = nextTotal;
      shownCount++;
    }

    if (shownCount < requests.length) {
      description += `...and ${requests.length - shownCount} more`;
    }

    const embed = new EmbedBuilder()
      .setTitle('Top requested songs')
      .setDescription(description)
      .setColor(DEFAULT_COLOR);

    message.channel.send({
      embeds: [embed],
    });
  },
} as Command;
