import fs from 'node:fs';
import path from 'node:path';
import { config, filePath } from '../config.js';
import type { ConfigFile, PlaylistsFile, SessionsFile } from '../types/index.js';

export class StorageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StorageError';
  }
}

const EMPTY_PLAYLISTS: PlaylistsFile = { playlists: [] };
const EMPTY_SESSIONS: SessionsFile = { sessions: [] };
const EMPTY_CONFIG: ConfigFile = {
  masterPasswordHash: null,
  salt: null,
  oauth: {
    connected: false,
    accessToken: null,
    refreshToken: null,
    expiresAt: null,
    channelId: null,
    channelTitle: null,
  },
};

let writeQueue: Promise<unknown> = Promise.resolve();

function ensureDataDir(): void {
  if (!fs.existsSync(config.dataDir)) {
    fs.mkdirSync(config.dataDir, { recursive: true });
  }
}

async function readJson<T>(name: string, fallback: T): Promise<T> {
  const fp = filePath(name);
  ensureDataDir();
  if (!fs.existsSync(fp)) {
    return fallback;
  }
  try {
    const raw = await fs.promises.readFile(fp, 'utf-8');
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

async function writeJsonAtomic(name: string, data: unknown): Promise<void> {
  ensureDataDir();
  const fp = filePath(name);
  const tmp = path.join(config.dataDir, `${name}.${process.pid}.${Date.now()}.tmp`);
  const serialized = JSON.stringify(data, null, 2);
  await fs.promises.writeFile(tmp, serialized, 'utf-8');
  await fs.promises.rename(tmp, fp);
}

function enqueue<T>(operation: () => Promise<T>): Promise<T> {
  const result = writeQueue.then(operation);
  writeQueue = result.catch(() => undefined);
  return result;
}

export const storage = {
  readConfig(): Promise<ConfigFile> {
    return readJson<ConfigFile>(config.files.config, EMPTY_CONFIG);
  },

  readSessions(): Promise<SessionsFile> {
    return readJson<SessionsFile>(config.files.sessions, EMPTY_SESSIONS);
  },

  readPlaylists(): Promise<PlaylistsFile> {
    return readJson<PlaylistsFile>(config.files.playlists, EMPTY_PLAYLISTS);
  },

  writeConfig(data: ConfigFile): Promise<void> {
    return enqueue(() => writeJsonAtomic(config.files.config, data));
  },

  writeSessions(data: SessionsFile): Promise<void> {
    return enqueue(() => writeJsonAtomic(config.files.sessions, data));
  },

  writePlaylists(data: PlaylistsFile): Promise<void> {
    return enqueue(() => writeJsonAtomic(config.files.playlists, data));
  },
};