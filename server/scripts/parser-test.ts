import { parseTitle } from '../src/services/parser.service.js';

const samples = [
  'Artista - Título (Official Music Video)',
  'Artista - Título [Audio]',
  'Artista feat. Colab - Título (Lyric Video)',
  'Coldplay - Hymn For The Weekend [Official Video]',
  'Queen – Bohemian Rhapsody (Official Video Remastered)',
  'Daft Punk - Get Lucky ft. Pharrell Williams (HD)',
  'Chill Beats (Lo-fi) | 4K Visualizer',
  'Single track name without artist',
];

for (const s of samples) {
  console.log(JSON.stringify({ input: s, ...parseTitle(s) }));
}