export interface YoutubeVideo {
  id: string;
  duration: number;
  title: string;
}

export function pickBestVideo(
  videos: YoutubeVideo[],
  expectedDuration: number
): YoutubeVideo | null {
  if (videos.length === 0) {
    return null;
  }

  const MAX_DIFF_SEC = 15;

  const acceptable = videos.filter(
    (v) => Math.abs(v.duration - expectedDuration) <= MAX_DIFF_SEC
  );

  if (acceptable.length > 0) {
    return acceptable[0];
  }

  // Pick closest duration from all
  return [...videos].sort((a, b) => {
    const diffA = Math.abs(a.duration - expectedDuration);
    const diffB = Math.abs(b.duration - expectedDuration);
    return diffA - diffB;
  })[0];
}
