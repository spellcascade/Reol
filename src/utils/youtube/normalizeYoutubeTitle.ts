const BRACKETED_SEGMENT_REGEX =
  /(\[[^[\]]*\]|\([^()]*\)|\{[^{}]*\}|【[^【】]*】|〖[^〖〗]*〗|「[^「」]*」|『[^『』]*』)/g;
const INLINE_NOISE_REGEXES = [
  /\b(?:hd|hq|uhd|4k|8k|1080p|720p|2160p|1440p|480p|360p)\b/gi,
  /\bofficial\s+(?:(?:music|lyric)\s+)?(?:video|audio|visuali[sz]er|m\s*\/?\s*v|pv)\b/gi,
  /\b(?:music|lyric)\s+video\b/gi,
  /\blyrics?(?:\s+on\s+screen)?\b/gi,
  /\bvisuali[sz]er\b/gi,
  /\bclip\s+(?:officiel|oficial)\b/gi,
  /\bvideo\s+lyric\s+oficial\b/gi,
  /\bwith\s+lyrics?\b/gi,
  /\bm\s*\/\s*v\b/gi,
  /\bmv\b/gi,
  /\bpv\b/gi,
  /\bremaster(?:ed)?\b/gi,
];
const FEATURED_ARTIST_REGEX = /\s+(?:feat\.?|ft\.?|featuring)\s+.+$/i;
const FEATURED_ARTIST_DESCRIPTOR_REGEX =
  /^(?:feat\.?|ft\.?|featuring)\s+.+$/i;
const PROTECTED_VARIANT_REGEX =
  /\b(remix|cover|parody|gachi|right\s+version|ai\s+(?:cover|version)|sped\s*up|slowed|live|acoustic|instrumental|mashup|phonk|nightcore|extended)\b/i;
const NOISE_DESCRIPTOR_TOKENS = new Set([
  'official',
  'video',
  'music',
  'audio',
  'lyric',
  'lyrics',
  'visualizer',
  'visualiser',
  'clip',
  'officiel',
  'oficial',
  'hd',
  'hq',
  'uhd',
  '4k',
  '8k',
  '1080p',
  '720p',
  '2160p',
  '1440p',
  '480p',
  '360p',
  'mv',
  'm',
  'v',
  'pv',
  'with',
  'on',
  'screen',
  'remastered',
  'remaster',
  'explicit',
  'clean',
  'karaoke',
  'full',
  'high',
  'quality',
  'color',
  'colour',
  'coded',
  'eng',
  'english',
  'sub',
  'subs',
  'espanol',
  'romanized',
  'romanization',
  'tiktok',
]);
const YEAR_TOKEN_REGEX = /^(?:19|20)\d{2}$/;
const DESCRIPTOR_TOKEN_SPLIT_REGEX = /[^\p{L}\p{N}]+/gu;

export function normalizeYoutubeTitle(title: string): string {
  const prepared = prepareTitle(title);
  const titleWithoutPipe = stripTrailingPipe(prepared);
  const clearSplit = splitArtistAndName(titleWithoutPipe);

  if (clearSplit) {
    const artist = cleanArtistPart(clearSplit.artist);
    const name = cleanSongPart(clearSplit.name);

    if (artist && name) {
      return `${artist} - ${name}`;
    }
  }

  return cleanWholeTitle(titleWithoutPipe);
}

function prepareTitle(title: string): string {
  return title
    .normalize('NFKC')
    .replace(/\s+[–—−]\s+/g, ' - ')
    .replace(/\s+-\s+/g, ' - ')
    .replace(/^\s*\d+\.\s+/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function stripTrailingPipe(title: string): string {
  const pipeIndex = title.indexOf('|');
  if (pipeIndex === -1) {
    return title;
  }

  const left = title.slice(0, pipeIndex).trim();
  return left || title;
}

function splitArtistAndName(title: string):
  | { artist: string; name: string }
  | null {
  const separator = ' - ';
  const separatorIndex = title.indexOf(separator);

  if (separatorIndex === -1) {
    return null;
  }

  const artist = title.slice(0, separatorIndex).trim();
  const name = title.slice(separatorIndex + separator.length).trim();

  if (!artist || !name) {
    return null;
  }

  return { artist, name };
}

function cleanWholeTitle(part: string): string {
  return finalizeSpacing(
    removeInlineNoise(canonicalizeBracketSegments(part, false)),
  );
}

function cleanArtistPart(part: string): string {
  const withoutFeatured = canonicalizeBracketSegments(part, true).replace(
    FEATURED_ARTIST_REGEX,
    '',
  );
  return finalizeSpacing(withoutFeatured);
}

function cleanSongPart(part: string): string {
  let cleaned = canonicalizeBracketSegments(part, false);
  cleaned = removeInlineNoise(cleaned);
  cleaned = cleaned.replace(FEATURED_ARTIST_REGEX, '');
  return finalizeSpacing(cleaned);
}

function canonicalizeBracketSegments(
  part: string,
  dropFeaturedArtists: boolean,
): string {
  return part.replace(BRACKETED_SEGMENT_REGEX, (segment) => {
    const content = segment.slice(1, -1).trim();
    if (!content) {
      return ' ';
    }

    const normalizedContent = normalizeDescriptorContent(content);
    if (!normalizedContent) {
      return ' ';
    }

    if (
      shouldDropDescriptor(normalizedContent) ||
      FEATURED_ARTIST_DESCRIPTOR_REGEX.test(normalizedContent)
    ) {
      return ' ';
    }

    let next = normalizedContent;
    if (dropFeaturedArtists) {
      next = next.replace(FEATURED_ARTIST_REGEX, '');
    }

    next = finalizeSpacing(next);
    return next ? ` (${next}) ` : ' ';
  });
}

function normalizeDescriptorContent(content: string): string {
  return content
    .replace(/[♂♀]/gu, ' ')
    .replace(/\s+/g, ' ')
    .replace(/[–—−]/g, '-')
    .trim();
}

function shouldDropDescriptor(content: string): boolean {
  if (PROTECTED_VARIANT_REGEX.test(content)) {
    return false;
  }

  return isPureNoiseDescriptor(content);
}

function isPureNoiseDescriptor(content: string): boolean {
  const tokens = content
    .normalize('NFKC')
    .toLowerCase()
    .split(DESCRIPTOR_TOKEN_SPLIT_REGEX)
    .filter(Boolean);

  if (!tokens.length) {
    return true;
  }

  return tokens.every(
    (token) =>
      NOISE_DESCRIPTOR_TOKENS.has(token) || YEAR_TOKEN_REGEX.test(token),
  );
}

function removeInlineNoise(part: string): string {
  let result = part;
  for (const regex of INLINE_NOISE_REGEXES) {
    result = result.replace(regex, ' ');
  }

  return result;
}

function finalizeSpacing(part: string): string {
  return part
    .replace(/[♂♀]/gu, ' ')
    .replace(/\p{Extended_Pictographic}|\p{Emoji_Presentation}/gu, ' ')
    .replace(/[\u200d\ufe0f]/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\(\s*\)/g, ' ')
    .replace(/\s+([)\]])/g, '$1')
    .replace(/([([{])\s+/g, '$1')
    .replace(/^[\s"'`~|,.:;!_\-♂]+/u, '')
    .replace(/[\s"'`~|,.:;!_\-♂]+$/u, '')
    .trim();
}
