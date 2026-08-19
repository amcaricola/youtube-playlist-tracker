import { config } from '../config.js';
import { storage } from './storage.service.js';
import { checkVideosStatus } from './youtube.service.js';
import type { Playlist, Track, TrackStatus } from '../types/index.js';

const MS_PER_HOUR = 60 * 60 * 1000;

export function tracksDueForCheck(playlists: Playlist[], now = new Date()): Track[] {
  const cutoff = now.getTime() - config.checkIntervalHours * MS_PER_HOUR;
  const due: Track[] = [];
  for (const playlist of playlists) {
    for (const track of playlist.tracks) {
      if (!track.lastCheckedAt) {
        due.push(track);
        continue;
      }
      const last = new Date(track.lastCheckedAt).getTime();
      if (last <= cutoff) due.push(track);
    }
  }
  return due;
}

export async function syncDueTracks(force = false): Promise<{ checked: number; updated: number }> {
  const file = await storage.readPlaylists();
  if (file.playlists.length === 0) return { checked: 0, updated: 0 };

  const now = new Date();
  const dueIds = new Set<string>();
  for (const track of tracksDueForCheck(file.playlists, now)) {
    dueIds.add(track.youtubeVideoId);
  }
  if (!force && dueIds.size === 0) return { checked: 0, updated: 0 };

  const videoIds = force
    ? Array.from(new Set(file.playlists.flatMap((p) => p.tracks.map((t) => t.youtubeVideoId))))
    : Array.from(dueIds);

  const results = await checkVideosStatus(videoIds);

  let updated = 0;
  for (const playlist of file.playlists) {
    for (const track of playlist.tracks) {
      if (!force && !dueIds.has(track.youtubeVideoId)) continue;
      const check = results.get(track.youtubeVideoId);
      if (!check) continue;
      if (check.status !== track.status) {
        track.status = check.status;
        updated += 1;
      }
      track.lastCheckedAt = now.toISOString();
    }
  }

  await storage.writePlaylists(file);
  return { checked: videoIds.length, updated };
}

export function schedulePeriodicSync(): void {
  const intervalMs = config.checkIntervalHours * MS_PER_HOUR;
  if (!Number.isFinite(intervalMs) || intervalMs <= 0) return;
  setInterval(() => {
    syncDueTracks().catch((err) => {
      console.error('[sync] Error en verificación programada:', err);
    });
  }, intervalMs).unref();
}