import { Hono } from 'hono';
import { requireAuth } from '../middleware/auth.js';
import {
  deletePlaylist,
  importPlaylist,
  listPlaylists,
  refreshPlaylistStatus,
  replaceTrack,
} from '../services/playlist.service.js';

const playlistRoutes = new Hono();

playlistRoutes.use('*', requireAuth);

playlistRoutes.get('/', async (c) => {
  const playlists = await listPlaylists();
  return c.json({ success: true, data: playlists });
});

playlistRoutes.post('/import', async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as { playlistUrl?: string; playlistId?: string };
  const input = body.playlistUrl ?? body.playlistId;
  if (!input) {
    return c.json({ success: false, error: 'Indica la URL o el ID de la playlist.' }, 400);
  }
  try {
    const playlist = await importPlaylist(input);
    return c.json({
      success: true,
      data: playlist,
      message: `Playlist importada: ${playlist.tracks.length} canciones.`,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error al importar la playlist.';
    const status = err instanceof Error && 'statusCode' in err ? (err as { statusCode: number }).statusCode : 500;
    return c.json({ success: false, error: message }, status);
  }
});

playlistRoutes.delete('/:id', async (c) => {
  try {
    await deletePlaylist(c.req.param('id'));
    return c.json({ success: true, message: 'Playlist eliminada de la app.' });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error al eliminar.';
    const status = err instanceof Error && 'statusCode' in err ? (err as { statusCode: number }).statusCode : 500;
    return c.json({ success: false, error: message }, status);
  }
});

playlistRoutes.post('/:id/sync', async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as { force?: boolean };
  try {
    const result = await refreshPlaylistStatus(c.req.param('id'), Boolean(body.force));
    return c.json({
      success: true,
      data: result,
      message: `Verificadas ${result.checked} canciones, ${result.updated} cambiaron de estado.`,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error al sincronizar.';
    const status = err instanceof Error && 'statusCode' in err ? (err as { statusCode: number }).statusCode : 500;
    return c.json({ success: false, error: message }, status);
  }
});

playlistRoutes.post('/replace-track', async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as {
    playlistId?: string;
    trackId?: string;
    newVideoId?: string;
  };
  if (!body.playlistId || !body.trackId || !body.newVideoId) {
    return c.json(
      { success: false, error: 'Se requieren playlistId, trackId y newVideoId.' },
      400,
    );
  }
  try {
    const track = await replaceTrack(body.playlistId, body.trackId, body.newVideoId);
    return c.json({ success: true, data: track, message: 'Canción reemplazada con éxito.' });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error al reemplazar la canción.';
    const status = err instanceof Error && 'statusCode' in err ? (err as { statusCode: number }).statusCode : 500;
    return c.json({ success: false, error: message }, status);
  }
});

export default playlistRoutes;