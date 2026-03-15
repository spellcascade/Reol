import { Command } from '../interfaces/Command';
import { ENV } from '../utils/ENV';

export default {
  name: 'active',
  description: 'Show active servers',
  aliases: [],
  async execute(client, message) {
    const isAdmin = ENV.ADMINS.includes(message.author.id);
    if (!isAdmin) return;

    const servers = client.guilds.cache
      .map((guild) => ({
        id: guild.id,
        name: guild.name,
        isPlaying:
          client.queues.get(guild.id)?.player?.state?.status === 'playing',
        queueLength: client.queues.get(guild.id)?.tracks?.length || 0,
        currentTrack: client.queues.get(guild.id)?.tracks?.[0],
      }))
      .filter((server) => server.isPlaying || server.queueLength > 0);

    if (servers.length === 0) {
      return message.channel.send('No active servers');
    }

    const msg = `Active servers:\n${servers
      .map((s) => {
        return `- **${s.name}**: ${
          s.currentTrack?.title || 'No track playing'
        } (${s.queueLength} in queue)`;
      })
      .join('\n')}`;

    return message.channel.send(msg);
  },
} as Command;
