import { spawn } from 'child_process';
import {
  Client,
  GatewayIntentBits,
  Options,
  VoiceBasedChannel,
} from 'discord.js';
import { ENV } from '../utils/ENV';
import {
  NoSubscriberBehavior,
  StreamType,
  createAudioPlayer,
  createAudioResource,
  joinVoiceChannel,
} from '@discordjs/voice';

async function main() {
  try {
    await client.login(ENV.TOKEN);
    client.on('ready', async () => {
      console.log('ready');

      const voiceChannel = client.channels.cache.get(
        ENV.VOICE_CHANNEL_ID
      ) as VoiceBasedChannel;
      const guildId = 'xxx';

      const connection = joinVoiceChannel({
        channelId: voiceChannel.id,
        guildId,
        adapterCreator: voiceChannel.guild.voiceAdapterCreator as any,
        selfDeaf: false,
      });

      const player = createAudioPlayer({
        behaviors: { noSubscriber: NoSubscriberBehavior.Play },
      });
      connection.subscribe(player);

      console.time('resource');
      const r = await createResourceLocal(
        'https://www.youtube.com/watch?v=0-yRE2_M78o'
      );
      console.timeEnd('resource');
      if (!r) throw new Error('Failed to create resource');
      player.play(r);
    });
  } catch (error) {
    if (error instanceof Error) {
      console.error(error.message);
    } else {
      console.error('Unexpected error:', error);
    }
  }
}

async function createResourceLocal(url: string) {
  const start = Date.now();
  console.log(`[yt-dlp] Starting stream for: ${url}`);

  const ytdlp = spawn(
    'yt-dlp',
    [
      '-f',
      'bestaudio[acodec=opus]/bestaudio',
      '-o',
      '-',
      '--concurrent-fragments',
      '4',
      '--hls-use-mpegts',
      '--geo-bypass-country=DE',
      '--no-write-info-json',
      '--no-write-playlist-metafiles',
      '--no-cache-dir',
      '--quiet',
      '--no-progress',
      url,
    ],
    { stdio: ['ignore', 'pipe', 'inherit'] }
  );

  const stdout = ytdlp.stdout;
  if (!stdout) throw new Error('yt-dlp did not produce a stream');

  stdout.once('data', () => {
    const delta = ((Date.now() - start) / 1000).toFixed(2);
    console.log(`[yt-dlp] First audio bytes received after ${delta}s`);
  });

  ytdlp.on('close', (code) => {
    const total = ((Date.now() - start) / 1000).toFixed(2);
    console.log(`[yt-dlp] Process exited with code ${code} after ${total}s`);
  });

  const resource = createAudioResource(stdout, {
    inputType: StreamType.WebmOpus,
  });

  const created = ((Date.now() - start) / 1000).toFixed(2);
  console.log(`[yt-dlp] createAudioResource() completed after ${created}s`);

  return resource;
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
  ],
  makeCache: Options.cacheWithLimits({
    MessageManager: 0,
    ThreadManager: 0,
    ReactionManager: 0,
    GuildMemberManager: 50,
    VoiceStateManager: 50,
  }),
});

main().catch(console.error);
