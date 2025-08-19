import { TextChannel, VoiceBasedChannel } from 'discord.js';
import { Queue } from '../interfaces/Queue';
import {
  DiscordGatewayAdapterCreator,
  joinVoiceChannel,
} from '@discordjs/voice';
import { ENV } from '../utils/ENV';
import { Command } from '../interfaces/Command';
import { getTrack } from '../utils/getTrack';
import { isSpotifyURL } from '../utils/helpers';
import { getSpotifyTrackId } from '../utils/spotify/getSpotifyTrackId';
import { getTrackDetails } from '../external/spotify/getTrackDetails';
import { getSpotifyTrackTitle } from '../external/spotify/utils/getSpotifyTrackTitle';
import { getSimilarTracks } from '../external/spotify/getSimilarTracks';
import { RadioSession } from '../interfaces/RadioSession';

export default {
  name: 'radio',
  description: 'Start radio based on a spotify song',
  aliases: ['r'],
  async execute(client, message, args) {
    try {
      const voiceChannel =
        message.member?.voice.channel ||
        (client.channels.cache.get(ENV.VOICE_CHANNEL_ID) as VoiceBasedChannel);

      if (!voiceChannel) {
        return message.reply(
          'Please join a voice channel or set a voice channel in the .env file.'
        );
      }

      const guildId = message.guildId;
      if (!guildId) throw new GuildNotFoundError();

      const queue = client.queues.get(guildId);
      const currentTrack = queue?.tracks[0] || null;

      if (queue?.radioSession) {
        return message.reply('Radio is already running');
      }

      let radioFromQueue = false;

      let query = null;
      if (args && args.length > 0) {
        query = args.join(' ');
      } else {
        if (currentTrack?.metadata?.spotifyTrackId) {
          query = `https://open.spotify.com/track/${currentTrack.metadata.spotifyTrackId}`;
        } else {
          query = currentTrack?.title || currentTrack?.url;
        }

        radioFromQueue = true;
      }

      if (!query) {
        return message.reply('Please provide a query to start the radio');
      }

      const spotifyTrackId = await getSpotifyTrackId(query);
      if (!spotifyTrackId) {
        return message.reply(`Unable find spotify track from: ${query}`);
      }

      const spotifyTrack = await getTrackDetails(spotifyTrackId);
      const spotifyTrackTitle = getSpotifyTrackTitle(spotifyTrack);
      const track = await getTrack(
        isSpotifyURL(query) ? spotifyTrackTitle : query
      );

      if (!spotifyTrack) {
        throw new Error(`Unable to get spotify track for ${spotifyTrackId}`);
      }

      const similarTracks = await getSimilarTracks(spotifyTrackId);
      const tracks = similarTracks.map((t) => ({
        spotifyId: t.id,
        title: t.title,
      }));

      if (tracks.length < 10) {
        throw new Error('Not enough similar tracks found, cant start radio.');
      }

      track.requestedBy = message.author.displayName;
      track.metadata = {
        artist: spotifyTrack.artists[0].name,
        title: spotifyTrack.name,
        spotifyTrackId,
      };

      // Remove the first track from the list, as it will be played first
      tracks.shift();

      if (queue) {
        if (!radioFromQueue) {
          queue.enqueue(track);
        }

        queue.radioSession = new RadioSession(tracks);

        if (queue.tracks.length > 0) {
          return message.channel.send(
            `Will play radio based on: **${spotifyTrackTitle}** after queue ends, use **!upcoming** to see upcoming tracks`
          );
        }
      } else {
        const newQueue = new Queue({
          message,
          textChannel: message.channel as TextChannel,
          radioSession: new RadioSession(tracks),
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

        return message.channel.send(
          `Starting radio based on: **${spotifyTrackTitle}**, use **!upcoming** to see upcoming tracks`
        );
      }
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
