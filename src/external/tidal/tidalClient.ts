import axios, { AxiosHeaders } from 'axios';
import { ENV } from '../../utils/ENV';

interface TidalTokenResponse {
  access_token?: string;
  expires_in?: number;
}

let cachedAccessToken: string | null = null;
let cachedAccessTokenExpiresAt = 0;
let pendingAccessToken: Promise<string> | null = null;

export const tidalClient = axios.create({
  baseURL: 'https://openapi.tidal.com/v2',
  headers: {
    accept: 'application/vnd.api+json',
  },
});

tidalClient.interceptors.request.use(async (config) => {
  const accessToken = await getAccessToken();
  const headers = AxiosHeaders.from(config.headers);

  headers.set('Authorization', `Bearer ${accessToken}`);
  config.headers = headers;

  return config;
});

async function getAccessToken(): Promise<string> {
  if (!ENV.TIDAL_CLIENT_ID || !ENV.TIDAL_CLIENT_SECRET) {
    throw new Error(
      'TIDAL_CLIENT_ID and TIDAL_CLIENT_SECRET must be set to load TIDAL tracks.',
    );
  }

  if (cachedAccessToken && Date.now() < cachedAccessTokenExpiresAt - 60_000) {
    return cachedAccessToken;
  }

  if (pendingAccessToken) {
    return pendingAccessToken;
  }

  pendingAccessToken = requestAccessToken().finally(() => {
    pendingAccessToken = null;
  });

  return pendingAccessToken;
}

async function requestAccessToken(): Promise<string> {
  const response = await axios.post<TidalTokenResponse>(
    'https://auth.tidal.com/v1/oauth2/token',
    new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: ENV.TIDAL_CLIENT_ID!,
      client_secret: ENV.TIDAL_CLIENT_SECRET!,
    }),
    {
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        accept: 'application/json',
      },
      auth: {
        username: ENV.TIDAL_CLIENT_ID!,
        password: ENV.TIDAL_CLIENT_SECRET!,
      },
    },
  );

  const accessToken = response.data?.access_token;
  if (!accessToken) {
    throw new Error('Failed to retrieve a TIDAL access token.');
  }

  const expiresInSec =
    typeof response.data?.expires_in === 'number' &&
    Number.isFinite(response.data.expires_in)
      ? response.data.expires_in
      : 0;

  cachedAccessToken = accessToken;
  cachedAccessTokenExpiresAt = Date.now() + expiresInSec * 1000;

  return accessToken;
}
