import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { config } from './config.js';
import { ensureMasterPasswordConfigured } from './services/auth.service.js';
import { schedulePeriodicSync } from './services/sync.service.js';
import authRoutes from './routes/auth.routes.js';
import healthRoutes from './routes/health.routes.js';
import playlistRoutes from './routes/playlist.routes.js';
import youtubeRoutes from './routes/youtube.routes.js';

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

  serve({ fetch: app.fetch, port: config.port }, (info) => {
    console.log(`[server] YouTube Playlist Tracker API escuchando en http://localhost:${info.port}`);
  });

  schedulePeriodicSync();
}

bootstrap().catch((err) => {
  console.error('[bootstrap]', err);
  process.exit(1);
});