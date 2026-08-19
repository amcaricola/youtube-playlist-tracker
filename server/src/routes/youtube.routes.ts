import { Hono } from 'hono';
import crypto from 'node:crypto';
import { requireAuth } from '../middleware/auth.js';
import { config } from '../config.js';
import {
  disconnectOAuth,
  exchangeCode,
  getOAuthStatus,
  getOAuthUrl,
  searchTracks,
} from '../services/youtube.service.js';

const youtubeRoutes = new Hono();

const pendingStates = new Map<string, { createdAt: number }>();

youtubeRoutes.get('/oauth/url', requireAuth, async (c) => {
  const state = crypto.randomBytes(16).toString('hex');
  pendingStates.set(state, { createdAt: Date.now() });
  const url = getOAuthUrl(state);
  return c.json({ success: true, data: { url, state } });
});

youtubeRoutes.get('/oauth/callback', async (c) => {
  const code = c.req.query('code');
  const state = c.req.query('state');
  const error = c.req.query('error');

  if (error || !code) {
    return c.redirect(`${config.clientUrl}/settings?oauth=error`);
  }
  if (!state || !pendingStates.has(state)) {
    return c.redirect(`${config.clientUrl}/settings?oauth=invalid`);
  }
  pendingStates.delete(state);

  try {
    const channel = await exchangeCode(code);
    return c.redirect(`${config.clientUrl}/settings?oauth=connected`);
  } catch (err) {
    console.error('[oauth] Error al intercambiar el código:', err);
    return c.redirect(`${config.clientUrl}/settings?oauth=failed`);
  }
});

youtubeRoutes.get('/oauth/status', requireAuth, async (c) => {
  const status = await getOAuthStatus();
  return c.json({ success: true, data: status });
});

youtubeRoutes.post('/oauth/disconnect', requireAuth, async (c) => {
  await disconnectOAuth();
  return c.json({ success: true, message: 'OAuth desconectado.' });
});

youtubeRoutes.get('/search', requireAuth, async (c) => {
  const q = c.req.query('q');
  if (!q || q.trim() === '') {
    return c.json({ success: false, error: 'Parámetro "q" requerido.' }, 400);
  }
  try {
    const results = await searchTracks(q.trim());
    return c.json({ success: true, data: results });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error al buscar en YouTube.';
    return c.json({ success: false, error: message }, 500);
  }
});

export default youtubeRoutes;