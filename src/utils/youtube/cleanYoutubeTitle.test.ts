import { cleanYoutubeTitle } from './cleanYoutubeTitle';

describe('cleanYoutubeTitle', () => {
  it('returns the normalized title wrapper value', () => {
    expect(
      cleanYoutubeTitle(
        'Travis Scott - Goosebumps feat. Kendrick Lamar (Official Video)',
      ),
    ).toBe('Travis Scott - Goosebumps');
  });

  it('preserves materially different variants', () => {
    expect(cleanYoutubeTitle('Disclosure - You & Me (Flume Remix)')).toBe(
      'Disclosure - You & Me (Flume Remix)',
    );
  });

  it('removes music video noise in any order', () => {
    expect(
      cleanYoutubeTitle('The Weeknd - Blinding Lights (Official 4K Video)'),
    ).toBe('The Weeknd - Blinding Lights');

    expect(
      cleanYoutubeTitle('The Weeknd - Blinding Lights [4K Official Video]'),
    ).toBe('The Weeknd - Blinding Lights');

    expect(cleanYoutubeTitle('The Weeknd - Blinding Lights (M/V)')).toBe(
      'The Weeknd - Blinding Lights',
    );

    expect(
      cleanYoutubeTitle('The Weeknd - Blinding Lights (Official HD Video)'),
    ).toBe('The Weeknd - Blinding Lights');

    expect(cleanYoutubeTitle('米津玄師 - Lemon 【MV】')).toBe(
      '米津玄師 - Lemon',
    );
  });

  it('removes emojis and featured artists', () => {
    expect(cleanYoutubeTitle("Livin' On A Prayer - Bon Jovi (Lyrics) 🎵")).toBe(
      "Livin' On A Prayer - Bon Jovi",
    );

    expect(cleanYoutubeTitle('Miyagi & Эндшпиль feat. KADI - In Love')).toBe(
      'Miyagi & Эндшпиль - In Love',
    );
  });

  it('does not remove words that are part of the song name', () => {
    expect(cleanYoutubeTitle('Justice - Audio, Video, Disco')).toBe(
      'Justice - Audio, Video, Disco',
    );

    expect(cleanYoutubeTitle('Official髭男dism - Pretender')).toBe(
      'Official髭男dism - Pretender',
    );
  });

  it('falls back to the raw query when everything is noise', () => {
    expect(cleanYoutubeTitle('(Official Video)')).toBe('(Official Video)');
  });
});
