import crypto from 'node:crypto';
import { config } from '../config.js';
import { storage } from './storage.service.js';
import type { AuthResponse, Session } from '../types/index.js';

const SCRYPT_KEYLEN = 64;
const TOKEN_BYTES = 32;

function deriveKey(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, SCRYPT_KEYLEN, (err, derivedKey) => {
      if (err) reject(err);
      else resolve(derivedKey);
    });
  });
}

export async function hashPassword(password: string, salt: Buffer): Promise<string> {
  const key = await deriveKey(password, salt);
  return key.toString('hex');
}

export async function verifyMasterPassword(password: string): Promise<boolean> {
  const cfg = await storage.readConfig();
  if (!cfg.masterPasswordHash || !cfg.salt) return false;
  const expected = Buffer.from(cfg.masterPasswordHash, 'hex');
  const salt = Buffer.from(cfg.salt, 'hex');
  const candidate = await deriveKey(password, salt);
  return crypto.timingSafeEqual(expected, candidate);
}

export async function ensureMasterPasswordConfigured(): Promise<void> {
  const cfg = await storage.readConfig();
  if (cfg.masterPasswordHash && cfg.salt) return;
  const password = config.masterPassword;
  if (!password) {
    throw new Error('MASTER_PASSWORD no está configurada. Revísala en el .env y reinicia.');
  }
  const salt = crypto.randomBytes(16);
  const hash = await hashPassword(password, salt);
  await storage.writeConfig({
    ...cfg,
    masterPasswordHash: hash,
    salt: salt.toString('hex'),
  });
}

function generateToken(): string {
  return crypto.randomBytes(TOKEN_BYTES).toString('hex');
}

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function isExpired(session: Session, now = Date.now()): boolean {
  return new Date(session.expiresAt).getTime() <= now;
}

function purgeExpired(sessions: Session[], now = Date.now()): Session[] {
  return sessions.filter((s) => !isExpired(s, now));
}

export async function createSession(
  userAgent?: string,
  ip?: string,
): Promise<AuthResponse> {
  const file = await storage.readSessions();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + config.sessionTtlDays * 24 * 60 * 60 * 1000);

  const token = generateToken();
  const session: Session = {
    tokenHash: hashToken(token),
    createdAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
    userAgent,
    ip,
  };

  const active = purgeExpired(file.sessions);
  active.push(session);
  await storage.writeSessions({ sessions: active });

  return { token, expiresAt: expiresAt.toISOString() };
}

export async function validateToken(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  const file = await storage.readSessions();
  const tokenHash = hashToken(token);
  const now = Date.now();
  return file.sessions.some((s) => s.tokenHash === tokenHash && !isExpired(s, now));
}

export async function revokeToken(token: string): Promise<void> {
  const file = await storage.readSessions();
  const tokenHash = hashToken(token);
  await storage.writeSessions({
    sessions: file.sessions.filter((s) => s.tokenHash !== tokenHash),
  });
}

export async function blockAllSessions(): Promise<number> {
  const file = await storage.readSessions();
  const revoked = file.sessions.length;
  await storage.writeSessions({ sessions: [] });
  return revoked;
}

export async function getSessionSummary(): Promise<{ count: number; expiresAt: string | null }> {
  const file = await storage.readSessions();
  const active = purgeExpired(file.sessions);
  if (active.length === 0) return { count: 0, expiresAt: null };
  const soonest = active.reduce<Session>(
    (min, s) => (new Date(s.expiresAt).getTime() < new Date(min.expiresAt).getTime() ? s : min),
    active[0],
  );
  return { count: active.length, expiresAt: soonest.expiresAt };
}

export function sessionTtlMs(): number {
  return config.sessionTtlDays * 24 * 60 * 60 * 1000;
}