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
import { Mutex } from 'async-mutex';
import { cacheTrack } from '../utils/track/caching/manager';

const wait = promisify(setTimeout);
const MAX_CACHE_DURATION_SEC = 600;

interface Options {
  message: Message;
  textChannel: TextChannel;
  connection: VoiceConnection;
}

interface QueuedItem {
  track: Track;
  resource: AudioResource;
}

export class Queue {
  public readonly message: Message;
  public readonly connection: VoiceConnection;
  public readonly player: AudioPlayer;
  public readonly textChannel: TextChannel;
  public readonly client = client;
  public readonly guildId: string;

  public resource?: AudioResource;
  public items: QueuedItem[] = [];
  public muted = false;
  public waitTimeout: NodeJS.Timeout | null;
  public pendingResourceCreations = 0;

  private readyLock = false;
  private stopped = false;
  private pumpMutex = new Mutex();

  constructor(options: Options) {
    this.message = options.message;
    this.connection = options.connection;
    this.textChannel = options.textChannel;
    this.guildId = this.connection.joinConfig.guildId!;

    this.player = createAudioPlayer({
      behaviors: { noSubscriber: NoSubscriberBehavior.Play },
    });
    this.connection.subscribe(this.player);

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
        if (this.stopped) return;

        // Track finished
        if (
          oldState.status !== AudioPlayerStatus.Idle &&
          newState.status === AudioPlayerStatus.Idle
        ) {
          this.items.shift();

          void this.pump();
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
      if (this.stopped) return;

      console.error(error);
      this.items.shift();

      void this.pump();
    });
  }

  public async enqueue(
    triggerMessage: Message,
    track: Track,
  ): Promise<boolean> {
    if (this.waitTimeout !== null) clearTimeout(this.waitTimeout);
    this.waitTimeout = null;
    this.stopped = false;
    this.pendingResourceCreations += 1;

    const trackStatusMessage = await triggerMessage.reply({
      content: 'Preparing track...',
      allowedMentions: { repliedUser: false },
    });

    const updateMessage = async (text: string) => {
      try {
        await trackStatusMessage.edit(text);
      } catch {}
    };

    try {
      const shouldCache = track.durationSec <= MAX_CACHE_DURATION_SEC;
      const resource = await createResource(track, updateMessage, shouldCache);

      await trackStatusMessage.delete().catch(() => {});
      this.items.push({ track, resource });

      if (this.player.state.status === AudioPlayerStatus.Idle) {
        await this.pump();
      } else {
        this.preCacheUpcoming();
      }

      return true;
    } catch (err: any) {
      const msg = err?.message || 'Failed to load track';
      await updateMessage(`Error: ${msg}`);
      return false;
    } finally {
      this.pendingResourceCreations = Math.max(
        0,
        this.pendingResourceCreations - 1,
      );

      if (
        !this.stopped &&
        this.pendingResourceCreations === 0 &&
        this.items.length === 0 &&
        this.player.state.status === AudioPlayerStatus.Idle
      ) {
        this.stop();
      }
    }
  }

  public stop() {
    if (this.stopped) return;

    this.stopped = true;
    this.items = [];

    this.player.stop();

    this.resetVoiceStatus();
    this.sendTextMessage('Queue ended');

    if (this.waitTimeout !== null) return;

    this.waitTimeout = setTimeout(() => {
      this.waitTimeout = null;

      if (
        this.player.state.status !== AudioPlayerStatus.Idle ||
        this.items.length > 0
      ) {
        return;
      }

      if (this.connection.state.status !== VoiceConnectionStatus.Destroyed) {
        try {
          this.connection.destroy();
        } catch {}
      }
      client.queues.delete(this.guildId);
    }, ENV.STAY_TIME_IN_SECONDS * 1000);
  }

  private async pump(): Promise<void> {
    if (this.stopped) return;

    await this.pumpMutex.runExclusive(async () => {
      if (this.stopped) return;
      if (this.player.state.status !== AudioPlayerStatus.Idle) return;

      if (!this.items.length) {
        if (this.pendingResourceCreations > 0) return;
        this.stop();
        return;
      }

      const current = this.items[0];
      this.resource = current.resource;
      this.player.play(current.resource);
      current.resource.volume?.setVolumeLogarithmic(1); // volume 100

      this.preCacheUpcoming();
    });
  }

  private async sendPlayingMessage() {
    try {
      const track = this.items[0]?.track;
      if (!track) return;

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
      return this.textChannel.send(message);
    } catch (error: any) {
      console.error('Error sending text message', error);
      return;
    }
  }

  public shuffle() {
    for (let i = this.items.length - 1; i >= 2; i--) {
      const j = 1 + Math.floor(Math.random() * (i - 1 + 1)); // [1..i]
      [this.items[i], this.items[j]] = [this.items[j], this.items[i]];
    }
  }

  async setPlayingVoiceStatus() {
    const track = this.items[0]?.track;
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

  async resetVoiceStatus() {
    try {
      await this.client.rest.put(
        `/channels/${this.connection.joinConfig.channelId}/voice-status`,
        { body: { status: '' } },
      );
    } catch (err) {
      console.debug('Failed to update voice channel status:', err);
    }
  }

  private preCacheUpcoming() {
    const upcoming = this.items[1]?.track;
    if (upcoming && upcoming.durationSec <= MAX_CACHE_DURATION_SEC) {
      void cacheTrack(upcoming);
    }
  }
}

function escapeMarkdown(text: string) {
  var unescaped = text.replace(/\\(\*|_|`|~|\\)/g, '$1');
  var escaped = unescaped.replace(/(\*|_|`|~|\\)/g, '\\$1');
  return escaped;
}
