import { Hono } from 'hono';
import { requireAuth } from '../middleware/auth.js';
import {
  blockAllSessions,
  createSession,
  getSessionSummary,
  revokeToken,
  verifyMasterPassword,
} from '../services/auth.service.js';

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
  const body = (await c.req.json().catch(() => ({}))) as { password?: string };
  if (!body.password) {
    return c.json({ success: false, error: 'La contraseña es obligatoria.' }, 400);
  }
  const valid = await verifyMasterPassword(body.password);
  if (!valid) {
    return c.json({ success: false, error: 'Contraseña incorrecta.' }, 401);
  }
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