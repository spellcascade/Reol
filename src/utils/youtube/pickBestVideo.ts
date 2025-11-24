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

  const MAX_DIFF_SEC = 10;
  const sortByDurationCloseness = (a: YoutubeVideo, b: YoutubeVideo) => {
    const diffA = Math.abs(a.duration - expectedDuration);
    const diffB = Math.abs(b.duration - expectedDuration);
    return diffA - diffB;
  };

  const closeMatches = videos.filter(
    (v) => Math.abs(v.duration - expectedDuration) <= MAX_DIFF_SEC
  );

  if (closeMatches.length > 0) {
    return [...closeMatches].sort(sortByDurationCloseness)[0];
  }

  return [...videos].sort(sortByDurationCloseness)[0];
}
