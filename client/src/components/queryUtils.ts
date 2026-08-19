export function buildSearchQuery(artist: string, title: string): string {
  return [artist, title].filter(Boolean).join(' - ');
}