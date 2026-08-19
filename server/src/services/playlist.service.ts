import crypto from 'node:crypto';
import { storage } from './storage.service.js';
import { parseTitle } from './parser.service.js';
import {
  checkVideosStatus,
  deletePlaylistItem,
  fetchPlaylistItems,
  fetchPlaylistMeta,
  insertPlaylistItem,
} from './youtube.service.js';
import type { Playlist, Track, TrackStatus } from '../types/index.js';

export class PlaylistServiceError extends Error {
  statusCode: number;
  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = 'PlaylistServiceError';
    this.statusCode = statusCode;
  }
}

function extractPlaylistId(input: string): string {
  const trimmed = input.trim();
  if (/^[A-Za-z0-9_-]{10,}$/.test(trimmed)) return trimmed;
  try {
    const url = new URL(trimmed);
    if (url.hostname.includes('youtube.com') || url.hostname.includes('youtu.be')) {
      const list = url.searchParams.get('list');
      if (list) return list;
    }
  } catch {
    /* no es URL */
  }
  throw new PlaylistServiceError('No se pudo extraer el ID de la playlist desde: ' + input);
}

function buildTrack(item: {
  playlistItemId: string;
  videoId: string;
  title: string;
  channelTitle: string;
  thumbnailUrl: string;
  position: number;
}): Track {
  const parsed = parseTitle(item.title);
  return {
    id: crypto.randomUUID(),
    youtubePlaylistItemId: item.playlistItemId,
    youtubeVideoId: item.videoId,
    title: parsed.title || item.title,
    artist: parsed.artist,
    originalYoutubeTitle: item.title,
    channelTitle: item.channelTitle,
    thumbnailUrl: item.thumbnailUrl,
    position: item.position,
    status: 'unknown' as TrackStatus,
    lastCheckedAt: null,
    customNotes: '',
    addedAt: new Date().toISOString(),
  };
}

export async function importPlaylist(input: string): Promise<Playlist> {
  const playlistId = extractPlaylistId(input);
  const file = await storage.readPlaylists();
  const existing = file.playlists.find((p) => p.youtubePlaylistId === playlistId);
  if (existing) {
    throw new PlaylistServiceError('Esa playlist ya está importada en la app.', 409);
  }

  const meta = await fetchPlaylistMeta(playlistId);
  const items = await fetchPlaylistItems(playlistId);

  const tracks = items.map(buildTrack);

  const playlist: Playlist = {
    id: crypto.randomUUID(),
    youtubePlaylistId: meta.id,
    title: meta.title,
    description: meta.description,
    channelId: meta.channelId,
    channelTitle: meta.channelTitle,
    thumbnailUrl: meta.thumbnailUrl,
    itemCount: meta.itemCount,
    importedAt: new Date().toISOString(),
    tracks,
  };

  file.playlists.push(playlist);
  await storage.writePlaylists(file);

  try {
    await refreshPlaylistStatus(playlist.id, true);
  } catch (err) {
    console.error('[import] No se pudo verificar el estado inicial:', err);
  }

  return playlist;
}

export async function listPlaylists(): Promise<Playlist[]> {
  const file = await storage.readPlaylists();
  return file.playlists;
}

export async function deletePlaylist(localId: string): Promise<void> {
  const file = await storage.readPlaylists();
  const before = file.playlists.length;
  file.playlists = file.playlists.filter((p) => p.id !== localId);
  if (file.playlists.length === before) {
    throw new PlaylistServiceError('Playlist no encontrada.', 404);
  }
  await storage.writePlaylists(file);
}

export async function refreshPlaylistStatus(
  localPlaylistId: string,
  force = false,
): Promise<{ checked: number; updated: number }> {
  const file = await storage.readPlaylists();
  const playlist = file.playlists.find((p) => p.id === localPlaylistId);
  if (!playlist) {
    throw new PlaylistServiceError('Playlist no encontrada.', 404);
  }

  const intervalMs = 24 * 60 * 60 * 1000;
  const now = new Date();
  const cutoff = now.getTime() - intervalMs;

  const toCheck = force
    ? playlist.tracks
    : playlist.tracks.filter((t) => !t.lastCheckedAt || new Date(t.lastCheckedAt).getTime() <= cutoff);

  if (toCheck.length === 0) return { checked: 0, updated: 0 };

  const ids = toCheck.map((t) => t.youtubeVideoId);
  const results = await checkVideosStatus(ids);

  let updated = 0;
  for (const track of playlist.tracks) {
    const check = results.get(track.youtubeVideoId);
    if (!check) continue;
    if (check.status !== track.status) {
      track.status = check.status;
      updated += 1;
    }
    track.lastCheckedAt = now.toISOString();
  }

  await storage.writePlaylists(file);
  return { checked: toCheck.length, updated };
}

export async function replaceTrack(
  localPlaylistId: string,
  trackId: string,
  newVideoId: string,
  insertAtSamePosition = true,
): Promise<Track> {
  const file = await storage.readPlaylists();
  const playlist = file.playlists.find((p) => p.id === localPlaylistId);
  if (!playlist) {
    throw new PlaylistServiceError('Playlist no encontrada.', 404);
  }
  const track = playlist.tracks.find((t) => t.id === trackId);
  if (!track) {
    throw new PlaylistServiceError('Canción no encontrada en la playlist.', 404);
  }

  const position = insertAtSamePosition ? track.position : undefined;
  const newPlaylistItemId = await insertPlaylistItem(playlist.youtubePlaylistId, newVideoId, position);

  if (track.youtubePlaylistItemId) {
    await deletePlaylistItem(track.youtubePlaylistItemId).catch((err) => {
      console.error('[replace] No se pudo eliminar el item original:', err);
    });
  }

  track.youtubePlaylistItemId = newPlaylistItemId;
  track.youtubeVideoId = newVideoId;
  track.status = 'active';
  track.lastCheckedAt = new Date().toISOString();
  track.originalYoutubeTitle = track.originalYoutubeTitle;

  await storage.writePlaylists(file);
  return track;
}

export function extractPlaylistIdPublic(input: string): string {
  return extractPlaylistId(input);
}