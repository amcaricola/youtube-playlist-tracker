import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { Context } from 'hono';
import { config } from './config.js';
import { ensureMasterPasswordConfigured } from './services/auth.service.js';
import { schedulePeriodicSync } from './services/sync.service.js';
import authRoutes from './routes/auth.routes.js';
import healthRoutes from './routes/health.routes.js';
import playlistRoutes from './routes/playlist.routes.js';
import youtubeRoutes from './routes/youtube.routes.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLIENT_DIST = path.resolve(__dirname, '../../client/dist');

function serveClientIndex(c: Context): Response {
  const indexPath = path.join(CLIENT_DIST, 'index.html');
  if (!fs.existsSync(indexPath)) {
    return c.html(
      '<!doctype html><meta charset="utf-8"><title>YouTube Playlist Tracker</title>' +
        '<body style="background:#0a0a0f;color:#d1d5db;font-family:system-ui;display:grid;place-items:center;height:100vh">' +
        '<div><h1>Frontend no construido</h1><p>Ejecuta <code>npm run build</code> o usa el dev server con <code>npm run dev</code>.</p></div>',
      503,
    );
  }
  const html = fs.readFileSync(indexPath, 'utf-8');
  return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}

async function bootstrap(): Promise<void> {
  await ensureMasterPasswordConfigured();

  const app = new Hono();

  app.use('*', cors({ origin: config.clientUrl, credentials: true, allowHeaders: ['Content-Type', 'Authorization'] }));

  app.onError((err, c) => {
    console.error('[error]', err);
    return c.json({ success: false, error: err.message ?? 'Error interno del servidor.' }, 500);
  });

  app.notFound((c) => {
    return c.json({ success: false, error: 'Ruta no encontrada.' }, 404);
  });

  app.route('/api/health', healthRoutes);
  app.route('/api/auth', authRoutes);
  app.route('/api/playlists', playlistRoutes);
  app.route('/api/youtube', youtubeRoutes);

  app.use('/assets/*', serveStatic({ root: CLIENT_DIST }));
  app.get('*', (c) => {
    if (c.req.path.startsWith('/api')) {
      return c.notFound();
    }
    return serveClientIndex(c);
  });

  serve({ fetch: app.fetch, port: config.port }, (info) => {
    console.log(`[server] YouTube Playlist Tracker escuchando en http://localhost:${info.port}`);
  });

  schedulePeriodicSync();
}

bootstrap().catch((err) => {
  console.error('[bootstrap]', err);
  process.exit(1);
});