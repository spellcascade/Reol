import { createAudioResource, StreamType } from '@discordjs/voice';
import fs from 'fs';
import { cacheTrack } from './cache/manager';

export async function createResource(url: string) {
  try {
    const cachePath = await cacheTrack(url);
    const resource = createAudioResource(fs.createReadStream(cachePath), {
      inputType: StreamType.OggOpus,
    });

    return resource;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to create resource: ${error.message}`);
    }
    throw new Error('Failed to create resource, unknown reason');
  }
}
