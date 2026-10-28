import axios from 'axios';
import { getLyrics } from './getLyrics';

describe('getLyrics', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('sanitizes the query before sending the request', async () => {
    const getSpy = jest.spyOn(axios, 'get').mockResolvedValue({ data: [] });

    await getLyrics({
      query: 'The Weeknd - Blinding Lights (Official 4K Video) 🎵',
    });

    expect(getSpy).toHaveBeenCalledWith(
      'https://lrclib.net/api/search',
      expect.objectContaining({
        params: { q: 'The Weeknd - Blinding Lights' },
      }),
    );
  });

  it('sanitizes the optional title before sending the request', async () => {
    const getSpy = jest.spyOn(axios, 'get').mockResolvedValue({ data: [] });

    await getLyrics({
      query: 'The Weeknd - Blinding Lights (Official Video)',
      title: 'Blinding Lights (Lyrics)',
    });

    expect(getSpy).toHaveBeenCalledWith(
      'https://lrclib.net/api/search',
      expect.objectContaining({
        params: {
          q: 'The Weeknd - Blinding Lights',
          track_name: 'Blinding Lights',
        },
      }),
    );
  });
});
