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

async function readJson<T>(name: string, fallback: () => T): Promise<T> {
  const fp = filePath(name);
  ensureDataDir();
  if (!fs.existsSync(fp)) {
    return fallback();
  }
  try {
    const raw = await fs.promises.readFile(fp, 'utf-8');
    return JSON.parse(raw) as T;
  } catch (err) {
    throw new StorageError(
      `No se pudo leer ${name}: ${err instanceof SyntaxError ? 'el JSON está corrupto.' : 'error de lectura.'}`,
    );
  }
}

async function writeJsonAtomic(name: string, data: unknown): Promise<void> {
  await writeTextAtomic(name, JSON.stringify(data, null, 2));
}

async function writeTextAtomic(name: string, content: string): Promise<void> {
  ensureDataDir();
  const fp = filePath(name);
  const tmp = path.join(config.dataDir, `${name}.${process.pid}.${Date.now()}.tmp`);
  await fs.promises.writeFile(tmp, content, 'utf-8');
  await fs.promises.rename(tmp, fp);
}

function enqueue<T>(operation: () => Promise<T>): Promise<T> {
  const result = writeQueue.then(operation);
  writeQueue = result.catch(() => undefined);
  return result;
}

async function updateJson<T>(name: string, fallback: () => T, update: (data: T) => T | Promise<T>): Promise<T> {
  return enqueue(async () => {
    const current = await readJson(name, fallback);
    const next = await update(current);
    await writeJsonAtomic(name, next);
    return next;
  });
}

export const storage = {
  readConfig(): Promise<ConfigFile> {
    return readJson<ConfigFile>(config.files.config, () => structuredClone(EMPTY_CONFIG));
  },

  readSessions(): Promise<SessionsFile> {
    return readJson<SessionsFile>(config.files.sessions, () => structuredClone(EMPTY_SESSIONS));
  },

  readPlaylists(): Promise<PlaylistsFile> {
    return readJson<PlaylistsFile>(config.files.playlists, () => structuredClone(EMPTY_PLAYLISTS));
  },

  updateConfig(update: (data: ConfigFile) => ConfigFile | Promise<ConfigFile>): Promise<ConfigFile> {
    return updateJson(config.files.config, () => structuredClone(EMPTY_CONFIG), update);
  },

  updateSessions(update: (data: SessionsFile) => SessionsFile | Promise<SessionsFile>): Promise<SessionsFile> {
    return updateJson(config.files.sessions, () => structuredClone(EMPTY_SESSIONS), update);
  },

  updatePlaylists(update: (data: PlaylistsFile) => PlaylistsFile | Promise<PlaylistsFile>): Promise<PlaylistsFile> {
    return updateJson(config.files.playlists, () => structuredClone(EMPTY_PLAYLISTS), update);
  },

  async replacePlaylistsWithBackup(data: PlaylistsFile): Promise<void> {
    await enqueue(async () => {
      const current = await readJson<PlaylistsFile>(config.files.playlists, () => structuredClone(EMPTY_PLAYLISTS));
      const backupName = `playlists.json.bak-${Date.now()}`;
      await writeTextAtomic(backupName, JSON.stringify(current, null, 2));
      await writeJsonAtomic(config.files.playlists, data);
    });
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

  async backupFile(name: string, content: string): Promise<void> {
    await enqueue(() => writeTextAtomic(name, content));
  },
};
