import crypto from 'node:crypto';
import { config } from '../config.js';
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
    const hostname = url.hostname.toLowerCase();
    if (hostname === 'youtu.be' || hostname === 'youtube.com' || hostname.endsWith('.youtube.com')) {
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

  await storage.updatePlaylists((current) => {
    if (current.playlists.some((p) => p.youtubePlaylistId === playlistId)) {
      throw new PlaylistServiceError('Esa playlist ya está importada en la app.', 409);
    }
    current.playlists.push(playlist);
    return current;
  });

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
  await storage.updatePlaylists((file) => {
    const before = file.playlists.length;
    file.playlists = file.playlists.filter((p) => p.id !== localId);
    if (file.playlists.length === before) {
      throw new PlaylistServiceError('Playlist no encontrada.', 404);
    }
    return file;
  });
}

export async function syncStructure(
  localPlaylistId: string,
): Promise<{ added: number; removed: number }> {
  const initialFile = await storage.readPlaylists();
  const initialPlaylist = initialFile.playlists.find((p) => p.id === localPlaylistId);
  if (!initialPlaylist) {
    throw new PlaylistServiceError('Playlist no encontrada.', 404);
  }

  const items = await fetchPlaylistItems(initialPlaylist.youtubePlaylistId);

  const itemsByItemId = new Map(items.map((i) => [i.playlistItemId, i]));
  const itemsByVideoId = new Map(items.map((i) => [i.videoId, i]));
  let newTracks: Track[] = [];
  let result = { added: 0, removed: 0 };
  const now = new Date().toISOString();

  await storage.updatePlaylists((file) => {
    const playlist = file.playlists.find((p) => p.id === localPlaylistId);
    if (!playlist) {
      throw new PlaylistServiceError('Playlist no encontrada.', 404);
    }

    const existingByItemId = new Map(playlist.tracks.map((t) => [t.youtubePlaylistItemId, t]));
    newTracks = [];
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
    result = { added: newTracks.length, removed };
    return file;
  });

  if (newTracks.length > 0) {
    try {
      const now = new Date().toISOString();
      const results = await checkVideosStatus(newTracks.map((t) => t.youtubeVideoId));
      const newTrackIds = new Set(newTracks.map((track) => track.id));
      await storage.updatePlaylists((file) => {
        const playlist = file.playlists.find((p) => p.id === localPlaylistId);
        if (!playlist) return file;
        for (const track of playlist.tracks) {
          if (!newTrackIds.has(track.id)) continue;
          const check = results.get(track.youtubeVideoId);
          if (check) {
            track.status = check.status;
            track.lastCheckedAt = now;
          }
        }
        return file;
      });
    } catch (err) {
      console.warn('[syncStructure] No se pudo verificar el estado de las nuevas canciones:', (err as Error).message);
    }
  }

  return result;
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

  const intervalMs = config.checkIntervalHours * 60 * 60 * 1000;
  const now = new Date();
  const cutoff = now.getTime() - intervalMs;

  const toCheck = (force
    ? playlist.tracks
    : playlist.tracks.filter((t) => !t.lastCheckedAt || new Date(t.lastCheckedAt).getTime() <= cutoff)
  ).filter((track) => track.status !== 'out_of_playlist');

  if (toCheck.length === 0) return { checked: 0, updated: 0 };

  const ids = Array.from(new Set(toCheck.map((t) => t.youtubeVideoId).filter(Boolean)));
  const results = await checkVideosStatus(ids);

  let updated = 0;
  const checkedIds = new Set(ids);
  await storage.updatePlaylists((current) => {
    const currentPlaylist = current.playlists.find((p) => p.id === localPlaylistId);
    if (!currentPlaylist) return current;
    for (const track of currentPlaylist.tracks) {
      if (track.status === 'out_of_playlist' || !checkedIds.has(track.youtubeVideoId)) continue;
      const check = results.get(track.youtubeVideoId);
      if (!check) continue;
      if (check.status !== track.status) {
        track.status = check.status;
        updated += 1;
      }
      track.lastCheckedAt = now.toISOString();
    }
    return current;
  });
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

  let updatedTrack: Track | undefined;
  await storage.updatePlaylists((current) => {
    const currentPlaylist = current.playlists.find((p) => p.id === localPlaylistId);
    const currentTrack = currentPlaylist?.tracks.find((t) => t.id === trackId);
    if (!currentPlaylist || !currentTrack) {
      throw new PlaylistServiceError('La canción ya no existe en la playlist local.', 409);
    }
    currentTrack.youtubePlaylistItemId = newPlaylistItemId;
    currentTrack.youtubeVideoId = newVideoId;
    currentTrack.status = 'active';
    currentTrack.lastCheckedAt = new Date().toISOString();
    updatedTrack = currentTrack;
    return current;
  });
  return updatedTrack as Track;
}

export async function updateTrack(
  localPlaylistId: string,
  trackId: string,
  updates: { title?: string; artist?: string },
): Promise<Track> {
  let updatedTrack: Track | undefined;
  await storage.updatePlaylists((file) => {
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
    if (updates.artist !== undefined) track.artist = updates.artist.trim();
    updatedTrack = track;
    return file;
  });
  return updatedTrack as Track;
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

  const title = updates.title?.trim();
  if (updates.title !== undefined && !title) {
    throw new PlaylistServiceError('El título no puede quedar vacío.', 400);
  }
  const artist = updates.artist?.trim() ?? '';

  let updated = 0;
  await storage.updatePlaylists((file) => {
    const playlist = file.playlists.find((p) => p.id === localPlaylistId);
    if (!playlist) {
      throw new PlaylistServiceError('Playlist no encontrada.', 404);
    }
    for (const track of playlist.tracks) {
      if (!trackIds.includes(track.id)) continue;
      if (updates.title !== undefined) track.title = title as string;
      if (updates.artist !== undefined) track.artist = artist;
      updated += 1;
    }
    return file;
  });
  return updated;
}

export async function importBackup(raw: string): Promise<{ playlists: number; tracks: number }> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new PlaylistServiceError('El archivo no es un JSON válido.', 400);
  }

  const obj = parsed as { playlists?: unknown } | null;
  const incoming = obj?.playlists;
  if (!Array.isArray(incoming)) {
    throw new PlaylistServiceError('Formato de backup inválido: falta el arreglo de playlists.', 400);
  }

  const validStatuses = new Set<TrackStatus>([
    'active',
    'unavailable',
    'private',
    'deleted',
    'unknown',
    'out_of_playlist',
  ]);
  const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;
  const stringValue = (value: unknown, fallback = ''): string => (typeof value === 'string' ? value : fallback);
  const normalized = incoming.map((rawPlaylist, playlistIndex): Playlist => {
    if (!isRecord(rawPlaylist)) {
      throw new PlaylistServiceError(`Formato de backup inválido: playlist ${playlistIndex + 1}.`, 400);
    }
    const id = stringValue(rawPlaylist.id);
    const youtubePlaylistId = stringValue(rawPlaylist.youtubePlaylistId);
    if (!id || !youtubePlaylistId) {
      throw new PlaylistServiceError('Formato de backup inválido: toda playlist necesita id y youtubePlaylistId.', 400);
    }
    if (!Array.isArray(rawPlaylist.tracks)) {
      throw new PlaylistServiceError(`Formato de backup inválido: tracks no es un arreglo en playlist ${id}.`, 400);
    }
    const tracks = rawPlaylist.tracks.map((rawTrack, trackIndex): Track => {
      if (!isRecord(rawTrack) || !stringValue(rawTrack.id) || !stringValue(rawTrack.youtubeVideoId)) {
        throw new PlaylistServiceError(`Formato de backup inválido: canción ${trackIndex + 1} en playlist ${id}.`, 400);
      }
      const title = stringValue(rawTrack.title);
      return {
        id: stringValue(rawTrack.id),
        youtubePlaylistItemId: stringValue(rawTrack.youtubePlaylistItemId),
        youtubeVideoId: stringValue(rawTrack.youtubeVideoId),
        title,
        artist: stringValue(rawTrack.artist),
        originalYoutubeTitle: stringValue(rawTrack.originalYoutubeTitle, title),
        thumbnailUrl: stringValue(rawTrack.thumbnailUrl),
        position:
          typeof rawTrack.position === 'number' && Number.isFinite(rawTrack.position)
            ? rawTrack.position
            : trackIndex,
        status: validStatuses.has(rawTrack.status as TrackStatus) ? (rawTrack.status as TrackStatus) : 'unknown',
        lastCheckedAt:
          rawTrack.lastCheckedAt === null || typeof rawTrack.lastCheckedAt === 'string' ? rawTrack.lastCheckedAt : null,
        customNotes: stringValue(rawTrack.customNotes),
        addedAt: stringValue(rawTrack.addedAt, new Date().toISOString()),
      };
    });
    return {
      id,
      youtubePlaylistId,
      title: stringValue(rawPlaylist.title, 'Sin título'),
      description: stringValue(rawPlaylist.description),
      channelId: stringValue(rawPlaylist.channelId),
      channelTitle: stringValue(rawPlaylist.channelTitle),
      thumbnailUrl: stringValue(rawPlaylist.thumbnailUrl),
      itemCount:
        typeof rawPlaylist.itemCount === 'number' && Number.isFinite(rawPlaylist.itemCount)
          ? rawPlaylist.itemCount
          : tracks.length,
      importedAt: stringValue(rawPlaylist.importedAt, new Date().toISOString()),
      tracks,
    };
  });
  let tracks = 0;
  for (const p of normalized) {
    tracks += p.tracks.length;
  }

  await storage.replacePlaylistsWithBackup({ playlists: normalized });
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
  const track = playlist.tracks[index];

  if (track.youtubePlaylistItemId && track.status !== 'out_of_playlist') {
    await ensureOAuthConnected();
    try {
      await deletePlaylistItem(track.youtubePlaylistItemId);
    } catch (err) {
      console.warn('[remove] No se pudo eliminar el item de YouTube (se elimina igual del registro local):', (err as Error).message);
    }
  }
  let removedTrack: Track | undefined;
  await storage.updatePlaylists((current) => {
    const currentPlaylist = current.playlists.find((p) => p.id === localPlaylistId);
    const currentIndex = currentPlaylist?.tracks.findIndex((t) => t.id === trackId) ?? -1;
    if (!currentPlaylist || currentIndex === -1) return current;
    [removedTrack] = currentPlaylist.tracks.splice(currentIndex, 1);
    currentPlaylist.itemCount = currentPlaylist.tracks.length;
    return current;
  });
  return removedTrack ?? track;
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

  const lostIds = new Set(lost.map((track) => track.id));
  for (const track of lost) {
    if (track.youtubePlaylistItemId && track.status !== 'out_of_playlist') {
      try {
        await deletePlaylistItem(track.youtubePlaylistItemId);
      } catch (err) {
        console.warn('[removeDamaged] No se pudo eliminar de YouTube (se elimina igual del registro local):', (err as Error).message);
      }
    }
  }

  let removed = 0;
  await storage.updatePlaylists((current) => {
    const currentPlaylist = current.playlists.find((p) => p.id === localPlaylistId);
    if (!currentPlaylist) return current;
    const before = currentPlaylist.tracks.length;
    currentPlaylist.tracks = currentPlaylist.tracks.filter(
      (track) => !lostIds.has(track.id) || !isDamaged(track.status) || !isLostInfo(track),
    );
    removed = before - currentPlaylist.tracks.length;
    currentPlaylist.itemCount = currentPlaylist.tracks.length;
    return current;
  });
  return removed;
}

export function extractPlaylistIdPublic(input: string): string {
  return extractPlaylistId(input);
}
