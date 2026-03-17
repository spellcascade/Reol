import {
  AudioPlayer,
  AudioPlayerState,
  AudioPlayerStatus,
  AudioResource,
  createAudioPlayer,
  entersState,
  NoSubscriberBehavior,
  VoiceConnection,
  VoiceConnectionDisconnectReason,
  VoiceConnectionState,
  VoiceConnectionStatus,
} from '@discordjs/voice';
import { Message, TextChannel } from 'discord.js';
import { promisify } from 'node:util';
import client from '..';
import { ENV } from '../utils/ENV';
import { Track } from './Track';
import { createResource } from '../utils/track/createResource';
import { YtDlpError } from '../external/ytdlp/ytdlp';

const wait = promisify(setTimeout);

interface Options {
  message: Message;
  textChannel: TextChannel;
  connection: VoiceConnection;
}

export class Queue {
  public readonly message: Message;
  public readonly connection: VoiceConnection;
  public readonly player: AudioPlayer;
  public readonly textChannel: TextChannel;
  public readonly client = client;

  public resource: AudioResource;
  public tracks: Track[] = [];
  public volume = 100;
  public muted = false;
  public waitTimeout: NodeJS.Timeout | null;

  private queueLock = false;
  private readyLock = false;
  private stopped = false;

  constructor(options: Options) {
    this.message = options.message;
    this.connection = options.connection;
    this.textChannel = options.textChannel;

    this.player = createAudioPlayer({
      behaviors: { noSubscriber: NoSubscriberBehavior.Play },
    });
    this.connection.subscribe(this.player);
    this.setupListeners();
  }

  public enqueue(...tracks: Track[]) {
    if (this.waitTimeout !== null) clearTimeout(this.waitTimeout);
    this.waitTimeout = null;
    this.stopped = false;
    this.tracks = this.tracks.concat(tracks);

    this.processQueue();
  }

  public stop() {
    if (this.stopped) return;

    this.stopped = true;
    this.tracks = [];

    this.player.stop();

    this.resetVoiceStatusMessage();
    this.sendTextMessage('Queue ended');

    if (this.waitTimeout !== null) return;

    this.waitTimeout = setTimeout(() => {
      if (this.connection.state.status !== VoiceConnectionStatus.Destroyed) {
        try {
          this.connection.destroy();
        } catch {}
      }
      client.queues.delete(this.message.guild!.id);

      this.sendTextMessage('Left voice channel');
    }, ENV.STAY_TIME_IN_SECONDS * 1000);
  }

  public async processQueue(): Promise<void> {
    if (this.queueLock) return;
    if (this.player.state.status !== AudioPlayerStatus.Idle) return;
    if (this.tracks.length === 0) {
      this.stop();
      return;
    }

    this.queueLock = true;

    try {
      const track = this.tracks[0];
      const resource = await this.loadTrackResource(track);

      this.resource = resource;
      this.player.play(resource);
      resource.volume?.setVolumeLogarithmic(this.volume / 100);
    } catch (error) {
      console.error('createResource error', error);
      this.tracks.shift();
    } finally {
      this.queueLock = false;
    }

    if (
      this.tracks.length === 0 &&
      this.player.state.status === AudioPlayerStatus.Idle
    ) {
      this.stop();
      return;
    }

    if (this.player.state.status === AudioPlayerStatus.Idle) {
      void this.processQueue();
    }
  }

  private async sendPlayingMessage() {
    try {
      const track = this.tracks[0];
      return this.sendTextMessage(
        `**Now playing**: ${track.url}` +
          (track.requestedBy ? `\nRequested by **${track.requestedBy}**` : ''),
      );
    } catch (error: any) {
      console.error(error);
      this.sendTextMessage(error.message);
      return;
    }
  }

  private async sendTextMessage(message: string) {
    try {
      this.textChannel.send(message);
    } catch (error: any) {
      console.error('Error sending text message', error);
      return;
    }
  }

  public shuffle() {
    for (let i = this.tracks.length - 1; i > 1; i--) {
      let j = 1 + Math.floor(Math.random() * i);
      [this.tracks[i], this.tracks[j]] = [this.tracks[j], this.tracks[i]];
    }
  }

  async setPlayingVoiceStatus() {
    const track = this.tracks[0];
    if (!track) return;

    const artist = track.metadata?.artist;
    const title = track.metadata?.title ?? track.title;
    const status = escapeMarkdown(
      (artist ? `${artist} - ${title}` : title).slice(0, 128),
    );

    try {
      await this.client.rest.put(
        `/channels/${this.connection.joinConfig.channelId}/voice-status`,
        { body: { status } },
      );
    } catch (err) {
      console.debug('Failed to update voice channel status:', err);
    }
  }

  async resetVoiceStatusMessage() {
    try {
      await this.client.rest.put(
        `/channels/${this.connection.joinConfig.channelId}/voice-status`,
        { body: { status: '' } },
      );
    } catch (err) {
      console.debug('Failed to update voice channel status:', err);
    }
  }

  private async loadTrackResource(track: Track): Promise<AudioResource> {
    const message = await this.message.reply('**Loading track...**');

    try {
      return await createResource(track.url, track.durationSec);
    } catch (err) {
      const userMessage =
        err instanceof YtDlpError
          ? (err.userMessage ?? 'Cannot load track.')
          : 'Cannot load track.';

      await message.edit(`**${userMessage}**`);
      throw err;
    }
  }

  private setupListeners() {
    const networkStateChangeHandler = (_: any, newNetworkState: any) => {
      const newUdp = Reflect.get(newNetworkState, 'udp');
      clearInterval(newUdp?.keepAliveInterval);
    };

    this.connection.on(
      'stateChange' as any,
      async (
        oldState: VoiceConnectionState,
        newState: VoiceConnectionState,
      ) => {
        Reflect.get(oldState, 'networking')?.off(
          'stateChange',
          networkStateChangeHandler,
        );
        Reflect.get(newState, 'networking')?.on(
          'stateChange',
          networkStateChangeHandler,
        );

        if (newState.status === VoiceConnectionStatus.Disconnected) {
          if (
            newState.reason ===
              VoiceConnectionDisconnectReason.WebSocketClose &&
            newState.closeCode === 4014
          ) {
            try {
              this.stop();
            } catch (e) {
              console.log(e);
              this.stop();
            }
          } else if (this.connection.rejoinAttempts < 5) {
            await wait((this.connection.rejoinAttempts + 1) * 5_000);
            this.connection.rejoin();
          } else {
            this.connection.destroy();
          }
        } else if (
          !this.readyLock &&
          (newState.status === VoiceConnectionStatus.Connecting ||
            newState.status === VoiceConnectionStatus.Signalling)
        ) {
          this.readyLock = true;
          try {
            await entersState(
              this.connection,
              VoiceConnectionStatus.Ready,
              20_000,
            );
          } catch (err) {
            console.log('Error entering state:', err);
            if (
              this.connection.state.status !== VoiceConnectionStatus.Destroyed
            ) {
              try {
                this.connection.destroy();
              } catch {}
            }
          } finally {
            this.readyLock = false;
          }
        }
      },
    );

    this.player.on(
      'stateChange' as any,
      async (oldState: AudioPlayerState, newState: AudioPlayerState) => {
        // Track finished
        if (
          oldState.status !== AudioPlayerStatus.Idle &&
          newState.status === AudioPlayerStatus.Idle
        ) {
          this.tracks.shift();

          if (this.tracks.length === 0) {
            return this.stop();
          }

          void this.processQueue();
          return;
        }

        // Playback started
        if (
          newState.status === AudioPlayerStatus.Playing &&
          oldState.status !== AudioPlayerStatus.Playing
        ) {
          this.sendPlayingMessage();
          this.setPlayingVoiceStatus();
        }
      },
    );

    this.player.on('error', (error) => {
      console.error(error);

      this.tracks.shift();
      void this.processQueue();
    });
  }
}

function escapeMarkdown(text: string) {
  var unescaped = text.replace(/\\(\*|_|`|~|\\)/g, '$1');
  var escaped = unescaped.replace(/(\*|_|`|~|\\)/g, '\\$1');
  return escaped;
}
