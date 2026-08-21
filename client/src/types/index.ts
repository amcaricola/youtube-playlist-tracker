export type TrackStatus = 'active' | 'unavailable' | 'private' | 'deleted' | 'unknown';

export interface Track {
  id: string;
  youtubePlaylistItemId: string;
  youtubeVideoId: string;
  title: string;
  artist: string;
  originalYoutubeTitle: string;
  thumbnailUrl: string;
  position: number;
  status: TrackStatus;
  lastCheckedAt: string | null;
  customNotes: string;
  addedAt: string;
}

export interface Playlist {
  id: string;
  youtubePlaylistId: string;
  title: string;
  description: string;
  channelId: string;
  channelTitle: string;
  thumbnailUrl: string;
  itemCount: number;
  importedAt: string;
  tracks: Track[];
}

export interface SearchResult {
  videoId: string;
  title: string;
  channelTitle: string;
  thumbnailUrl: string;
  publishedAt: string;
}

export interface OAuthStatus {
  connected: boolean;
  channelId: string | null;
  channelTitle: string | null;
}

export interface SessionSummary {
  count: number;
  expiresAt: string | null;
}

export interface AuthData {
  token: string;
  expiresAt: string;
}