import { Hono } from 'hono';
import { config } from '../config.js';

const healthRoutes = new Hono();

healthRoutes.get('/', (c) => {
  return c.json({
    success: true,
    data: {
      name: 'YouTube Playlist Tracker API',
      status: 'ok',
      version: '0.1.0',
      time: new Date().toISOString(),
      oauthConfigured: Boolean(config.oauth.clientId && config.oauth.clientSecret),
      apiKeyConfigured: Boolean(config.youtubeApiKey),
    },
  });
});

export default healthRoutes;