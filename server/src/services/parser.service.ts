const SUFFIX_PATTERNS = [
  /(?:\(|\[)\s*official\s+[^)\]]*(?:\)|\])/gi,
  /\(official\s+(lyric\s+|video\s+|audio\s+|visualizer\s+)?(video|audio|lyrics|visualizer|music video)\)/gi,
  /\[official\s+(lyric\s+|video\s+|audio\s+|visualizer\s+)?(video|audio|lyrics|visualizer|music video)\]/gi,
  /\(official\s+hd\)|\[official\s+hd\]/gi,
  /\(lyric\s+video\)|\(lyrics\)|\(lyric\)/gi,
  /\[lyric\s+video\]|\[lyrics\]|\[lyric\]/gi,
  /\(audio\)|\[audio\]|\(official\s+audio\)|\[official\s+audio\]/gi,
  /\(visualizer\)|\[visualizer\]/gi,
  /\(hd\)|\[hd\]|\(hq\)|\[hq\]|\(4k\)|\[4k\]/gi,
  /\(full\s+album\)|\[full\s+album\]/gi,
  /\(album\s+track\)|\[album\s+track\]/gi,
  /\(explicit\)|\[explicit\]/gi,
  /\(with\s+lyrics\)|\[with\s+lyrics\]/gi,
  /\(feat\.?\s+.*?\)/gi,
  /\[feat\.?\s+.*?\]/gi,
  /\s*[|｜][^|｜]*$/gi,
];

function stripSuffixes(title: string): string {
  let cleaned = title.trim();
  for (const pattern of SUFFIX_PATTERNS) {
    cleaned = cleaned.replace(pattern, '');
  }
  return cleaned.trim();
}

function splitArtistTitle(title: string): { artist: string; track: string } | null {
  const patterns = [
    /^(.+?)\s+[-–—]\s+(.+)$/,
    /^(.+?)\s+[-–—]\s+["'](.+)["']$/,
    /^(.+?)\s+[-–—]\s+\[(.+)\]$/,
  ];
  for (const pattern of patterns) {
    const match = title.match(pattern);
    if (match) {
      return { artist: match[1].trim(), track: match[2].trim() };
    }
  }
  return null;
}

function normalizeArtist(artist: string): string {
  let a = artist.trim().replace(/^feat\.?\s+/i, '').trim();
  a = a.replace(/\s*[|｜]\s*$/, '').trim();
  a = a.replace(/[•·]/g, '').trim();
  return a;
}

function normalizeTrack(track: string): string {
  return track.trim().replace(/[|｜]\s*$/, '').trim();
}

export function parseTitle(rawTitle: string): { artist: string; title: string } {
  const cleaned = stripSuffixes(rawTitle);
  const split = splitArtistTitle(cleaned);
  if (split && split.artist && split.track) {
    return {
      artist: normalizeArtist(split.artist),
      title: normalizeTrack(split.track),
    };
  }
  return { artist: '', title: normalizeTrack(cleaned) };
}

export function buildSearchQuery(artist: string, title: string): string {
  return [artist, title].filter(Boolean).join(' - ');
}