import { EmbedBuilder } from 'discord.js';
import { Command } from '../interfaces/Command';
import { DEFAULT_COLOR } from '../utils/helpers';
import { getSpotifyTrackId } from '../utils/spotify/getSpotifyTrackId';
import { getSimilarTracks } from '../external/spotify/getSimilarTracks';

export default {
  name: 'similar',
  description: 'Show similar spotify tracks',
  disabled: true,
  async execute(client, message, args) {
    try {
      const guildId = message.guildId;
      if (!guildId) throw new GuildNotFoundError();

      const queue = client.queues.get(guildId);
      const currentTrack = queue?.tracks[0];
      const query = (args || []).join(' ') || currentTrack?.title;
      if (!query) {
        return message.reply('Please provide a query');
      }

      const spotifyTrackId =
        currentTrack?.metadata?.spotifyTrackId ||
        (await getSpotifyTrackId(query));
      if (!spotifyTrackId) {
        return message.reply(`Unable find spotify track from: ${query}`);
      }

      const similarTracks = await getSimilarTracks(spotifyTrackId);
      if (similarTracks.length === 0) {
        return message.reply('No similar tracks found');
      }

      const tracksEmbed = new EmbedBuilder()
        .setTitle(`Similar track to ${similarTracks[0].title}`)
        .setColor(DEFAULT_COLOR);

      similarTracks.slice(1, 21).forEach((track, idx) => {
        tracksEmbed.addFields({
          name: `${idx + 1}. ${track.title}`,
          value: `https://open.spotify.com/track/${track.id}`,
        });
      });

      return message.channel.send({
        embeds: [tracksEmbed],
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
