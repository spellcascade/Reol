export function cleanYoutubeTitle(title: string): string {
  let cleanedTitle = title;

  const dashParts = cleanedTitle.split(' - ');
  if (dashParts.length >= 2) {
    const artist = dashParts[0];
    const song = dashParts.slice(1).join(' - ');
    return (cleanPart(artist) + ' - ' + cleanPart(song)).trim();
  }

  cleanedTitle = cleanPart(cleanedTitle);
  return cleanedTitle;
}

function cleanPart(part: string): string {
  const patternsToRemove = [
    /\[.*?\]/g,
    /\(.*?\)/g,
    /\{.*?\}/g,
    /HD|4K|1080p|720p|HQ/gi,
    /\b(official (video|music video)|lyrics|remix|cover|live|extended version|sub español)\b/gi,
    /\s*\*+\s?\S+\s?\*+$/,
    /\s*\.(avi|wmv|mpg|mpeg|flv)$/i,
    /\s*video\s*clip/i,
    /\s*\(\s*\)/g,
    /\s*with\s+lyrics?\s*$/i,
    /^\s*[-|,.:;"'~]+|[-|,.:;"'~]+\s*$/g,
    /\s+(feat\.?|ft\.?|featuring)\s+.+$/i,
  ];

  let result = part;
  for (const pattern of patternsToRemove) {
    result = result.replace(pattern, '');
  }

  // Normalize spaces
  return result.replace(/\s+/g, ' ').trim();
}
