import { EmbedBuilder } from 'discord.js';
import { Command } from '../interfaces/Command';
import { Lyrics, getLyrics } from '../utils/lyrics/getLyrics';
import { DEFAULT_COLOR } from '../utils/helpers';
import { truncateLongDescription } from '../utils/truncateDescription';
import { cleanYoutubeTitle } from '../utils/youtube/cleanYoutubeTitle';

function generateLyricsEmbed(lyric: Lyrics) {
  const embedDescription = truncateLongDescription(lyric.plainLyrics);
  const lyricsEmbed = new EmbedBuilder()
    .setTitle(`${lyric.name} (${lyric.artistName})`)
    .setDescription(embedDescription)
    .setColor(DEFAULT_COLOR);

  return lyricsEmbed;
}

export default {
  name: 'lyrics',
  aliases: ['l'],
  description: 'Get lyrics from query or current song.',
  async execute(client, message, args) {
    try {
      const guildId = message.guildId;
      if (!guildId) throw new GuildNotFoundError();

      const query = args?.join(' ');
      if (query) {
        const lyrics = await getLyrics({ query });
        const lyric = lyrics[0];
        if (!lyric) {
          return message.channel.send('No lyrics found.');
        }

        const lyricsEmbed = generateLyricsEmbed(lyric);
        return message.channel.send({ embeds: [lyricsEmbed] });
      }

      const queue = client.queues.get(guildId);
      if (!queue || !queue.tracks.length) {
        return message.channel.send('There is no queue.');
      }

      const track = queue.tracks[0];

      const lyrics = await getLyrics({
        query:
          track.metadata?.artist && track.metadata?.title
            ? `${track.metadata.artist} - ${track.metadata.title}`
            : cleanYoutubeTitle(track.title),
        title: track.metadata?.title,
      });
      const lyric = lyrics[0];

      if (!lyric) return message.channel.send('No lyrics found.');

      const lyricsEmbed = generateLyricsEmbed(lyric);
      return message.channel.send({ embeds: [lyricsEmbed] });
    } catch (error: any) {
      console.log(error);

      message.reply(
        error?.message || 'There was an error executing the command.',
      );
    }
  },
} as Command;
