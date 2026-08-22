import { Hono } from 'hono';
import crypto from 'node:crypto';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
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
const STATE_TTL_MS = 10 * 60 * 1000;

function pruneStates(): void {
  const cutoff = Date.now() - STATE_TTL_MS;
  for (const [key, value] of pendingStates) {
    if (value.createdAt < cutoff) pendingStates.delete(key);
  }
}

function oauthCompleteHtml(status: 'error' | 'invalid' | 'connected' | 'failed'): string {
  const targetOrigin = JSON.stringify(config.clientUrl);
  return (
    '<!doctype html><html lang="es"><head><meta charset="utf-8">' +
    '<title>YouTube OAuth</title></head><body style="background:#0a0a0f;color:#d1d5db;font-family:system-ui;' +
    'display:grid;place-items:center;height:100vh"><p>OAuth ' +
    status +
    '. Puedes cerrar esta ventana.</p>' +
    '<script>if(window.opener){window.opener.postMessage({type:"YPT_OAUTH",status:"' +
    status +
    '"},' + targetOrigin + ');}</script></body></html>'
  );
}

youtubeRoutes.get('/oauth/url', requireAuth, async (c) => {
  pruneStates();
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
    if (state) pendingStates.delete(state);
    return c.html(oauthCompleteHtml('error'));
  }
  if (!state || !pendingStates.has(state)) {
    return c.html(oauthCompleteHtml('invalid'));
  }
  pendingStates.delete(state);

  try {
    await exchangeCode(code);
    return c.html(oauthCompleteHtml('connected'));
  } catch (err) {
    console.error('[oauth] Error al intercambiar el código:', err);
    return c.html(oauthCompleteHtml('failed'));
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
    const rawStatus = err instanceof Error && 'statusCode' in err ? Number((err as { statusCode: unknown }).statusCode) : 500;
    const statusCode = (rawStatus >= 400 && rawStatus <= 599 ? rawStatus : 500) as ContentfulStatusCode;
    return c.json({ success: false, error: message }, statusCode);
  }
});

export default youtubeRoutes;
