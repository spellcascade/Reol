import { normalizeYoutubeTitle } from './normalizeYoutubeTitle';

export function cleanYoutubeTitle(title: string): string {
  return normalizeYoutubeTitle(title);
}
