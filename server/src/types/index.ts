export type TrackStatus = 'active' | 'unavailable' | 'private' | 'deleted' | 'unknown';

export interface Track {
  id: string;
  youtubePlaylistItemId: string;
  youtubeVideoId: string;
  title: string;
  artist: string;
  originalYoutubeTitle: string;
  channelTitle: string;
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

export interface PlaylistsFile {
  playlists: Playlist[];
}

export interface Session {
  tokenHash: string;
  createdAt: string;
  expiresAt: string;
  userAgent?: string;
  ip?: string;
}

export interface SessionsFile {
  sessions: Session[];
}

export interface OAuthState {
  connected: boolean;
  accessToken: string | null;
  refreshToken: string | null;
  expiresAt: string | null;
  channelId: string | null;
  channelTitle: string | null;
}

export interface ConfigFile {
  masterPasswordHash: string | null;
  salt: string | null;
  oauth: OAuthState;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface SearchResult {
  videoId: string;
  title: string;
  channelTitle: string;
  thumbnailUrl: string;
  publishedAt: string;
}

export interface ImportedPlaylistData {
  playlist: Playlist;
  notFoundCount: number;
}

export interface AuthResponse {
  token: string;
  expiresAt: string;
}