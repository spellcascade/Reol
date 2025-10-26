import { config } from 'dotenv';

config();

if (!process.env.TOKEN) {
  throw new Error('TOKEN is not defined');
}

export const ENV = {
  TOKEN: process.env.TOKEN as string,
  PREFIX: process.env.PREFIX || '!',
  TEXT_CHANNEL_ID: process.env.TEXT_CHANNEL_ID,
  VOICE_CHANNEL_ID: process.env.VOICE_CHANNEL_ID as string,
  STAY_TIME_IN_SECONDS: Number(process.env.STAY_TIME_IN_SECONDS) || 60,
  USE_DB: process.env.USE_DB || false,
  DB_PATH: process.env.DB_PATH || 'db/db.sqlite',
  PRIZE_POOL_CHANNEL_ID: process.env.PRIZE_POOL_CHANNEL_ID as string,
  SPOTIFY_CLIENT_ID: process.env.SPOTIFY_CLIENT_ID as string,
  SPOTIFY_CLIENT_SECRET: process.env.SPOTIFY_CLIENT_SECRET as string,
  ADMINS: process.env.ADMINS?.split(',') || [],
  IS_PROD: process.env.NODE_ENV === 'production',
  MAX_CACHE_SIZE_GB: Number(process.env.MAX_CACHE_SIZE_GB) || 1,
};
