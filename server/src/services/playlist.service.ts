import crypto from 'node:crypto';
import { storage } from './storage.service.js';
import { parseTitle } from './parser.service.js';
import {
  checkVideosStatus,
  deletePlaylistItem,
  ensureOAuthConnected,
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

export async function syncStructure(
  localPlaylistId: string,
): Promise<{ added: number; removed: number }> {
  const file = await storage.readPlaylists();
  const playlist = file.playlists.find((p) => p.id === localPlaylistId);
  if (!playlist) {
    throw new PlaylistServiceError('Playlist no encontrada.', 404);
  }

  const items = await fetchPlaylistItems(playlist.youtubePlaylistId);

  const itemsByItemId = new Map(items.map((i) => [i.playlistItemId, i]));
  const itemsByVideoId = new Map(items.map((i) => [i.videoId, i]));
  const existingByItemId = new Map(playlist.tracks.map((t) => [t.youtubePlaylistItemId, t]));
  const newTracks: Track[] = [];
  const now = new Date().toISOString();

  for (const item of items) {
    const existing = existingByItemId.get(item.playlistItemId);
    if (existing) {
      existing.position = item.position;
      if (existing.status === 'out_of_playlist') {
        existing.status = 'active';
        existing.lastCheckedAt = now;
      }
      continue;
    }
    newTracks.push(buildTrack(item));
  }

  let removed = 0;
  for (const track of playlist.tracks) {
    if (itemsByItemId.has(track.youtubePlaylistItemId)) continue;
    const readded = track.youtubeVideoId ? itemsByVideoId.get(track.youtubeVideoId) : undefined;
    if (readded) {
      track.youtubePlaylistItemId = readded.playlistItemId;
      track.position = readded.position;
      track.status = 'active';
      track.lastCheckedAt = now;
      continue;
    }
    if (track.status !== 'out_of_playlist') {
      track.status = 'out_of_playlist';
      track.lastCheckedAt = now;
      removed += 1;
    }
  }

  playlist.tracks.push(...newTracks);
  playlist.tracks.sort((a, b) => a.position - b.position);
  playlist.itemCount = playlist.tracks.length;
  await storage.writePlaylists(file);

  if (newTracks.length > 0) {
    try {
      const now = new Date().toISOString();
      const results = await checkVideosStatus(newTracks.map((t) => t.youtubeVideoId));
      for (const track of newTracks) {
        const check = results.get(track.youtubeVideoId);
        if (check) {
          track.status = check.status;
          track.lastCheckedAt = now;
        }
      }
      await storage.writePlaylists(file);
    } catch (err) {
      console.warn('[syncStructure] No se pudo verificar el estado de las nuevas canciones:', (err as Error).message);
    }
  }

  return { added: newTracks.length, removed };
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

  if (track.youtubePlaylistItemId && track.status !== 'out_of_playlist') {
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

export async function updateTrack(
  localPlaylistId: string,
  trackId: string,
  updates: { title?: string; artist?: string },
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

  if (updates.title !== undefined) {
    const title = updates.title.trim();
    if (!title) {
      throw new PlaylistServiceError('El título no puede quedar vacío.', 400);
    }
    track.title = title;
  }
  if (updates.artist !== undefined) {
    track.artist = updates.artist.trim();
  }

  await storage.writePlaylists(file);
  return track;
}

export async function bulkUpdateTracks(
  localPlaylistId: string,
  trackIds: string[],
  updates: { title?: string; artist?: string },
): Promise<number> {
  if (!Array.isArray(trackIds) || trackIds.length === 0) {
    throw new PlaylistServiceError('Indica al menos una canción.', 400);
  }
  if (updates.title === undefined && updates.artist === undefined) {
    throw new PlaylistServiceError('Indica al menos un campo a actualizar.', 400);
  }

  const file = await storage.readPlaylists();
  const playlist = file.playlists.find((p) => p.id === localPlaylistId);
  if (!playlist) {
    throw new PlaylistServiceError('Playlist no encontrada.', 404);
  }

  const title = updates.title?.trim();
  if (updates.title !== undefined && !title) {
    throw new PlaylistServiceError('El título no puede quedar vacío.', 400);
  }
  const artist = updates.artist?.trim() ?? '';

  let updated = 0;
  for (const track of playlist.tracks) {
    if (!trackIds.includes(track.id)) continue;
    if (updates.title !== undefined) track.title = title as string;
    if (updates.artist !== undefined) track.artist = artist;
    updated += 1;
  }

  await storage.writePlaylists(file);
  return updated;
}

export async function importBackup(raw: string): Promise<{ playlists: number; tracks: number }> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new PlaylistServiceError('El archivo no es un JSON válido.', 400);
  }

  const obj = parsed as { playlists?: unknown };
  const incoming = obj?.playlists;
  if (!Array.isArray(incoming)) {
    throw new PlaylistServiceError('Formato de backup inválido: falta el arreglo de playlists.', 400);
  }

  const normalized = incoming.map((p) => p as Playlist);
  let tracks = 0;
  for (const p of normalized) {
    if (!p.id || !p.youtubePlaylistId) {
      throw new PlaylistServiceError('Formato de backup inválido: toda playlist necesita id y youtubePlaylistId.', 400);
    }
    if (!Array.isArray(p.tracks)) p.tracks = [];
    tracks += p.tracks.length;
  }

  const current = await storage.readPlaylists();
  const backupName = `playlists.json.bak-${Date.now()}`;
  await storage.backupFile(backupName, JSON.stringify(current, null, 2));

  await storage.writePlaylists({ playlists: normalized });
  return { playlists: normalized.length, tracks };
}

function isDamaged(status: Track['status']): boolean {
  return (
    status === 'deleted' ||
    status === 'unavailable' ||
    status === 'private' ||
    status === 'out_of_playlist'
  );
}

const GENERIC_TITLES = [
  'deleted video',
  'private video',
  'video unavailable',
  'removed video',
  '[deleted video]',
  '[private video]',
  '[video unavailable]',
];

export function isLostInfo(track: Pick<Track, 'title' | 'artist'>): boolean {
  const title = track.title.trim().toLowerCase();
  return GENERIC_TITLES.includes(title) && !track.artist.trim();
}

export async function removeTrackFromPlaylist(localPlaylistId: string, trackId: string): Promise<Track> {
  const file = await storage.readPlaylists();
  const playlist = file.playlists.find((p) => p.id === localPlaylistId);
  if (!playlist) {
    throw new PlaylistServiceError('Playlist no encontrada.', 404);
  }
  const index = playlist.tracks.findIndex((t) => t.id === trackId);
  if (index === -1) {
    throw new PlaylistServiceError('Canción no encontrada.', 404);
  }
  const [track] = playlist.tracks.splice(index, 1);

  if (track.youtubePlaylistItemId && track.status !== 'out_of_playlist') {
    await ensureOAuthConnected();
    try {
      await deletePlaylistItem(track.youtubePlaylistItemId);
    } catch (err) {
      console.warn('[remove] No se pudo eliminar el item de YouTube (se elimina igual del registro local):', (err as Error).message);
    }
  }
  playlist.itemCount = playlist.tracks.length;
  await storage.writePlaylists(file);
  return track;
}

export async function removeDamagedTracks(localPlaylistId: string): Promise<number> {
  const file = await storage.readPlaylists();
  const playlist = file.playlists.find((p) => p.id === localPlaylistId);
  if (!playlist) {
    throw new PlaylistServiceError('Playlist no encontrada.', 404);
  }

  const lost = playlist.tracks.filter((t) => isDamaged(t.status) && isLostInfo(t));
  const needsOAuth = lost.some((t) => t.status !== 'out_of_playlist' && t.youtubePlaylistItemId);
  if (needsOAuth) {
    await ensureOAuthConnected();
  }

  let removed = 0;
  for (const track of lost) {
    if (track.youtubePlaylistItemId && track.status !== 'out_of_playlist') {
      try {
        await deletePlaylistItem(track.youtubePlaylistItemId);
      } catch (err) {
        console.warn('[removeDamaged] No se pudo eliminar de YouTube (se elimina igual del registro local):', (err as Error).message);
      }
    }
    removed += 1;
  }

  playlist.tracks = playlist.tracks.filter((t) => !(isDamaged(t.status) && isLostInfo(t)));
  playlist.itemCount = playlist.tracks.length;
  await storage.writePlaylists(file);
  return removed;
}

export function extractPlaylistIdPublic(input: string): string {
  return extractPlaylistId(input);
}