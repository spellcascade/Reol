export interface Track {
  url: string;
  title: string;
  durationFormatted: string;
  durationSec: number;
  requestedBy?: string;
  metadata?: TrackMetadata;
}

interface TrackMetadata {
  artist?: string;
  title?: string;
  spotifyTrackId?: string;
}
