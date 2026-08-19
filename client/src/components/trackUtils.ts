export const GENERIC_TITLES = [
  'deleted video',
  'private video',
  'video unavailable',
  'removed video',
  '[deleted video]',
  '[private video]',
  '[video unavailable]',
];

export function isGenericPlaceholder(track: { title: string; artist: string }): boolean {
  const title = track.title.trim().toLowerCase();
  return GENERIC_TITLES.includes(title) && !track.artist.trim();
}

export function isDamaged(status: string): boolean {
  return status === 'deleted' || status === 'unavailable';
}

export function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}