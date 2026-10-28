import axios from 'axios';

export interface Lyrics {
  name: string;
  trackName: string;
  artistName: string;
  plainLyrics: string;
  duration: number;
}

export async function getLyrics({
  query,
  title,
}: {
  query: string;
  title?: string;
}): Promise<Lyrics[]> {
  const data = await axios.get('https://lrclib.net/api/search', {
    params: {
      q: query,
      ...(title && {
        track_name: title,
      }),
    },
    headers: {
      'User-Agent': 'Reol discord bot (https://github.com/spellcascade/Reol)',
    },
  });

  const lyrics = (data?.data || []).filter((l: any) => l.plainLyrics) as any[];

  return lyrics;
}
