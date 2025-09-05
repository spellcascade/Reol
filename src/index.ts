import {
  Client,
  GatewayIntentBits,
  Collection,
  Snowflake,
  TextChannel,
} from 'discord.js';
import { loadCommands } from './utils/loadCommands';
import { Queue } from './interfaces/Queue';
import { ENV } from './utils/ENV';
import { SPOTIFY_REGEX, YOUTUBE_REGEX } from './utils/helpers';
import { AppDataSource } from './db';
import { Command } from './interfaces/Command';

if (!ENV.TOKEN) {
  throw new Error('TOKEN is not defined');
}

export class MyClient extends Client {
  public commands: Collection<string, any>;
  public queues = new Collection<Snowflake, Queue>();

  constructor(options: any) {
    super(options);
  }
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
  ],
}) as MyClient;

client.commands = new Collection();
client.queues = new Collection<Snowflake, Queue>();

client.login(ENV.TOKEN);

client.on('ready', async () => {
  await loadCommands(client);
  if (ENV.USE_DB) {
    await AppDataSource.initialize();
  }

  if (ENV.TEXT_CHANNEL_ID) {
    // send a message to the channel
    const channel = client.channels.cache.get(
      ENV.TEXT_CHANNEL_ID
    ) as TextChannel;
    if (channel) {
      channel.send(`**${client.user?.username}** is ready!`);
    }
  }

  console.log(`Logged in as ${client?.user?.tag}!`);
});

client.on('messageCreate', async (message) => {
  if (message.author.bot && message.webhookId === null) return;

  if (
    YOUTUBE_REGEX.test(message.content) ||
    SPOTIFY_REGEX.test(message.content) ||
    message.content.startsWith('!p ')
  ) {
    let query = message.content;
    if (query.startsWith('!p ')) {
      query = query.replace('!p ', '');
    }

    const cmd = client.commands.get('play');
    if (!cmd) return;

    return cmd.execute(client, message, [query]);
  }

  const prefix = ENV.PREFIX || '!';

  if (message.content.indexOf(prefix) !== 0) return;
  const args = message.content.slice(prefix.length).trim().split(/ +/g);

  const command = args?.shift()?.toLowerCase();
  if (!command) return;

  const cmd: Command =
    client.commands.get(command) ||
    client.commands.find((cmd) => cmd.aliases && cmd.aliases.includes(command));

  if (cmd) {
    if (cmd.disabled) {
      return message.reply('This command is currently disabled.');
    }

    cmd.execute(client, message, args);
  }
});

export default client;
