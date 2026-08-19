import { Hono } from 'hono';
import type { Context } from 'hono';
import { requireAuth } from '../middleware/auth.js';
import {
  blockAllSessions,
  createSession,
  getSessionSummary,
  revokeToken,
  verifyMasterPassword,
} from '../services/auth.service.js';

const MAX_FAILURES = 5;
const WINDOW_MS = 15 * 60 * 1000;
const LOCK_MS = 15 * 60 * 1000;

interface AttemptState {
  failures: number;
  firstFailureAt: number;
  lockedUntil: number | null;
}

const attempts = new Map<string, AttemptState>();

function pruneAttempts(): void {
  if (attempts.size < 100) return;
  const now = Date.now();
  for (const [key, state] of attempts) {
    if (!state.lockedUntil && now - state.firstFailureAt > WINDOW_MS) {
      attempts.delete(key);
    }
  }
}

function clientKey(c: Context): string {
  return c.req.header('x-forwarded-for') ?? c.req.header('user-agent') ?? 'unknown';
}

function isLocked(key: string): boolean {
  const state = attempts.get(key);
  if (!state) return false;
  if (state.lockedUntil && state.lockedUntil > Date.now()) return true;
  if (state.lockedUntil && state.lockedUntil <= Date.now()) {
    attempts.delete(key);
    return false;
  }
  return false;
}

function recordFailure(key: string): void {
  const now = Date.now();
  const state = attempts.get(key) ?? { failures: 0, firstFailureAt: now, lockedUntil: null };
  if (now - state.firstFailureAt > WINDOW_MS) {
    state.failures = 0;
    state.firstFailureAt = now;
  }
  state.failures += 1;
  if (state.failures >= MAX_FAILURES) {
    state.lockedUntil = now + LOCK_MS;
    state.failures = 0;
  }
  attempts.set(key, state);
}

function recordSuccess(key: string): void {
  attempts.delete(key);
}

const authRoutes = new Hono();

authRoutes.get('/status', async (c) => {
  const { storage } = await import('../services/storage.service.js');
  const cfg = await storage.readConfig();
  return c.json({
    success: true,
    data: { configured: Boolean(cfg.masterPasswordHash && cfg.salt) },
  });
});

authRoutes.post('/login', async (c) => {
  pruneAttempts();
  const key = clientKey(c);
  if (isLocked(key)) {
    return c.json(
      { success: false, error: 'Demasiados intentos fallidos. Espera unos minutos antes de reintentar.' },
      429,
    );
  }
  const body = (await c.req.json().catch(() => ({}))) as { password?: string };
  if (!body.password) {
    return c.json({ success: false, error: 'La contraseña es obligatoria.' }, 400);
  }
  const valid = await verifyMasterPassword(body.password);
  if (!valid) {
    recordFailure(key);
    return c.json({ success: false, error: 'Contraseña incorrecta.' }, 401);
  }
  recordSuccess(key);
  const userAgent = c.req.header('user-agent');
  const ip = c.req.header('x-forwarded-for') ?? 'desconocida';
  const session = await createSession(userAgent, ip);
  return c.json({ success: true, data: session });
});

authRoutes.post('/logout', requireAuth, async (c) => {
  const header = c.req.header('authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  await revokeToken(token);
  return c.json({ success: true, message: 'Sesión cerrada.' });
});

authRoutes.post('/block-all', requireAuth, async (c) => {
  const revoked = await blockAllSessions();
  return c.json({ success: true, message: `Todas las sesiones fueron revocadas (${revoked}).` });
});

authRoutes.get('/session', requireAuth, async (c) => {
  const summary = await getSessionSummary();
  return c.json({ success: true, data: summary });
});

export default authRoutes;