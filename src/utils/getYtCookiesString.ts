import { promises as fs } from 'fs';
import { fileExists } from './fileExists';
import { paths } from '../constants/paths';

function formatCookies(cookies: Record<string, string>): string {
  return Object.entries(cookies)
    .map(([name, value]) => `${name}=${value}`)
    .join('; ');
}

async function parseNetscapeCookies(
  filePath: string
): Promise<Record<string, string>> {
  const cookies: Record<string, string> = {};
  const fileContent = await fs.readFile(filePath, 'utf-8');
  const lines = fileContent.split('\n');

  for (const line of lines) {
    if (line.startsWith('#') || line.trim() === '') {
      continue;
    }
    const parts = line.split('\t');
    if (parts.length !== 7) {
      continue;
    }

    const cookieName = parts[5];
    const cookieValue = parts[6];
    cookies[cookieName] = cookieValue;
  }
  return cookies;
}

/**
 * This function only works with Netscape cookies.
 */
export async function getYtCookiesString(): Promise<string | null> {
  const exists = await fileExists(paths.cookies);
  if (!exists) return null;

  const cookies = await parseNetscapeCookies(paths.cookies);
  const cookieStr = formatCookies(cookies);

  return cookieStr;
}
