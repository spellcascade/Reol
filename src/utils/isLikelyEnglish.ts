export function isLikelyEnglish(str: string): boolean {
  console.log('shit called');
  // Return true if text only has Latin letters, numbers, spaces, and punctuation
  const NON_LATIN_RE =
    /[^\p{Script=Latin}\p{Number}\p{Punctuation}\p{Separator}]/u;

  return !NON_LATIN_RE.test(str);
}
