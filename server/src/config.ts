import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const DATA_DIR = process.env.DATA_DIR ?? path.resolve(__dirname, '../data');

function numberFromEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === '') return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export const config = {
  port: numberFromEnv('PORT', 3000),
  dataDir: DATA_DIR,
  masterPassword: process.env.MASTER_PASSWORD ?? '',
  youtubeApiKey: process.env.YOUTUBE_API_KEY ?? '',
  oauth: {
    clientId: process.env.YOUTUBE_OAUTH_CLIENT_ID ?? '',
    clientSecret: process.env.YOUTUBE_OAUTH_CLIENT_SECRET ?? '',
    redirectUri:
      process.env.YOUTUBE_OAUTH_REDIRECT_URI ?? 'http://localhost:3000/api/youtube/oauth/callback',
  },
  clientUrl: process.env.CLIENT_URL ?? 'http://localhost:5173',
  sessionTtlDays: numberFromEnv('SESSION_TTL_DAYS', 30),
  checkIntervalHours: numberFromEnv('CHECK_INTERVAL_HOURS', 24),
  batchSize: Math.min(numberFromEnv('BATCH_SIZE', 50), 50),
  files: {
    config: 'config.json',
    sessions: 'sessions.json',
    playlists: 'playlists.json',
  },
} as const;

export function filePath(name: string): string {
  return path.join(DATA_DIR, name);
}

export function ensureDataDir(): void {
  // fs.mkdirSync(DATA_DIR, { recursive: true }) — se ejecuta en storage.service
}