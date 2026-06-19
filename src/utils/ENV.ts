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
  USE_DB: process.env.USE_DB === 'true',
  DB_PATH: process.env.DB_PATH || 'db/db.sqlite',
  ADMINS: process.env.ADMINS?.split(',') || [],
  IS_PROD: process.env.NODE_ENV === 'production',
  CACHE_TTL_DAYS: Number(process.env.CACHE_TTL_DAYS) || 7,
  TIDAL_CLIENT_ID: process.env.TIDAL_CLIENT_ID,
  TIDAL_CLIENT_SECRET: process.env.TIDAL_CLIENT_SECRET,
  TIDAL_COUNTRY_CODE: process.env.TIDAL_COUNTRY_CODE || 'US',
};
