import { normalizeYoutubeTitle } from './normalizeYoutubeTitle';

describe('normalizeYoutubeTitle', () => {
  it('merges official video and lyrics variants', () => {
    expect(
      normalizeYoutubeTitle(
        'Bruno Mars - Locked Out Of Heaven (Official Music Video)',
      ),
    ).toBe('Bruno Mars - Locked Out Of Heaven');

    expect(normalizeYoutubeTitle('The Weeknd - The Hills (Lyrics)')).toBe(
      'The Weeknd - The Hills',
    );
  });

  it('normalizes unicode dash separators and duplicate spaces', () => {
    expect(
      normalizeYoutubeTitle('GSPD – ЗАРЯЖЕННЫЙ 2019 (Official Video)'),
    ).toBe('GSPD - ЗАРЯЖЕННЫЙ 2019');
  });

  it('removes trailing feat text from the song side only', () => {
    expect(
      normalizeYoutubeTitle(
        'Travis Scott - goosebumps ft. Kendrick Lamar',
      ),
    ).toBe('Travis Scott - goosebumps');
  });

  it('keeps materially different variants separate', () => {
    expect(normalizeYoutubeTitle('Disclosure - You & Me (Flume Remix)')).toBe(
      'Disclosure - You & Me (Flume Remix)',
    );

    expect(normalizeYoutubeTitle('Fifty Fifty - Cupid (gay parody)')).toBe(
      'Fifty Fifty - Cupid (gay parody)',
    );

    expect(
      normalizeYoutubeTitle('The Weeknd - The Hills (Right ♂ Version ♂)'),
    ).toBe('The Weeknd - The Hills (Right Version)');

    expect(
      normalizeYoutubeTitle(
        'Cupid – Twin Ver. (FIFTY FIFTY) – Sped Up Version',
      ),
    ).toBe('Cupid - Twin Ver. (FIFTY FIFTY) - Sped Up Version');
  });

  it('handles titles without a clear artist and song split', () => {
    expect(normalizeYoutubeTitle('Balaclava')).toBe('Balaclava');
  });
});
