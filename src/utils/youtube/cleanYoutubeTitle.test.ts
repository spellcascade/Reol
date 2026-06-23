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
});
