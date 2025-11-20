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
import { createResourceWithRetry } from '../utils/track/createResource';
import { getTrack } from '../utils/getTrack';
import { RadioSession } from './RadioSession';
import { cacheTrack } from '../utils/track/caching/manager';

const wait = promisify(setTimeout);
const MAX_CACHE_DURATION_SEC = 600;

export interface QueueOptions {
  message: Message;
  textChannel: TextChannel;
  connection: VoiceConnection;
  radioSession?: RadioSession;
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
  public loop = false;
  public muted = false;
  public waitTimeout: NodeJS.Timeout | null;
  public radioSession: RadioSession | null;

  private queueLock = false;
  private readyLock = false;
  private stopped = false;

  constructor(options: QueueOptions) {
    this.message = options.message;
    this.connection = options.connection;
    this.textChannel = options.textChannel;
    this.radioSession = options?.radioSession || null;

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
        newState: VoiceConnectionState
      ) => {
        Reflect.get(oldState, 'networking')?.off(
          'stateChange',
          networkStateChangeHandler
        );
        Reflect.get(newState, 'networking')?.on(
          'stateChange',
          networkStateChangeHandler
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
              20_000
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
      }
    );

    this.player.on(
      'stateChange' as any,
      async (oldState: AudioPlayerState, newState: AudioPlayerState) => {
        // Track finished
        if (
          oldState.status !== AudioPlayerStatus.Idle &&
          newState.status === AudioPlayerStatus.Idle
        ) {
          if (this.loop && this.tracks.length) {
            this.tracks.push(this.tracks.shift()!);
          } else {
            this.tracks.shift();

            if (this.tracks.length === 0) {
              if (this.radioSession !== null) {
                this.processRadio();

                if (this.radioSession.getTracks().length === 0) {
                  this.stop();
                }

                return;
              }

              return this.stop();
            }
          }

          if (this.tracks.length || this.resource.audioPlayer) {
            this.processQueue();
          }
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
      }
    );

    this.player.on('error', (error) => {
      console.error(error);

      if (this.loop && this.tracks.length) {
        this.tracks.push(this.tracks.shift()!);
      } else {
        this.tracks.shift();
      }

      this.processQueue();
    });
  }

  public async processRadio() {
    if (this.radioSession === null) return;

    try {
      const nextTrack = this.radioSession.getNextTrack();
      if (!nextTrack) {
        this.radioSession = null;
        return this.sendTextMessage('Radio is over');
      }

      const track = await getTrack(nextTrack.title);
      track.requestedBy = 'Radio';
      if (!track) throw new Error('No track found');

      this.enqueue({
        ...track,
        metadata: {
          artist: '',
          title: nextTrack.title,
          spotifyTrackId: nextTrack.spotifyId,
        },
      });
    } catch (error: any) {
      return this.sendTextMessage(error?.message || 'An error occurred');
    }
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
    this.loop = false;
    this.tracks = [];

    this.radioSession = null;
    this.player.stop();

    this.resetVoiceStatus();
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
    const next = this.tracks[1];
    if (next && next.durationSec <= MAX_CACHE_DURATION_SEC) {
      cacheTrack(next);
    }

    if (this.queueLock || this.player.state.status !== AudioPlayerStatus.Idle) {
      return;
    }

    if (!this.tracks.length) {
      return this.stop();
    }

    this.queueLock = true;

    try {
      const resource = await this.loadTrackResource(this.tracks[0]);
      if (!resource) throw new Error('No resource');

      this.resource = resource;
      this.player.play(this.resource);

      this.resource.volume?.setVolumeLogarithmic(this.volume / 100);
    } catch (error) {
      console.error('createResource error', error);

      return this.processQueue();
    } finally {
      this.queueLock = false;
    }
  }

  private async sendPlayingMessage() {
    try {
      const track = this.tracks[0];
      return this.sendTextMessage(
        `**Now playing**: ${track.url}` +
          (track.requestedBy ? `\nRequested by **${track.requestedBy}**` : '')
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
    // we don't want to shuffle the first track
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
      (artist ? `${artist} - ${title}` : title).slice(0, 128)
    );

    try {
      await this.client.rest.put(
        `/channels/${this.connection.joinConfig.channelId}/voice-status`,
        { body: { status } }
      );
    } catch (err) {
      console.debug('Failed to update voice channel status:', err);
    }
  }

  async resetVoiceStatus() {
    try {
      await this.client.rest.put(
        `/channels/${this.connection.joinConfig.channelId}/voice-status`,
        { body: { status: '' } }
      );
    } catch (err) {
      console.debug('Failed to update voice channel status:', err);
    }
  }

  private async loadTrackResource(track: Track) {
    const panel = await this.textChannel.send(
      renderTrackStatus(track, 'Processing…')
    );

    const updatePanel = async (text: string) => {
      await panel.edit(renderTrackStatus(track, text));
    };

    try {
      const shouldCache = track.durationSec <= MAX_CACHE_DURATION_SEC;
      const resource = await createResourceWithRetry(
        track,
        updatePanel,
        shouldCache
      );

      panel.delete().catch(console.error);
      return resource;
    } catch (err: any) {
      const msg = err?.message || 'Failed to load track';
      await updatePanel(`Error: ${msg}`);
      throw msg;
    }
  }
}

function renderTrackStatus(track: Track, status: string) {
  return [
    `**┌ TRACK:   ${escapeMarkdown(track.title)}**`,
    `**└ STATUS:  ${status}**`,
  ].join('\n');
}

function escapeMarkdown(text: string) {
  var unescaped = text.replace(/\\(\*|_|`|~|\\)/g, '$1');
  var escaped = unescaped.replace(/(\*|_|`|~|\\)/g, '\\$1');
  return escaped;
}
