import { Hono } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import { requireAuth } from '../middleware/auth.js';
import {
  bulkUpdateTracks,
  deletePlaylist,
  importBackup,
  importPlaylist,
  listPlaylists,
  refreshPlaylistStatus,
  removeDamagedTracks,
  removeTrackFromPlaylist,
  replaceTrack,
  syncStructure,
  updateTrack,
} from '../services/playlist.service.js';

const playlistRoutes = new Hono();

function errStatus(err: unknown): ContentfulStatusCode {
  const code = err instanceof Error && 'statusCode' in err ? (err as { statusCode: number }).statusCode : 500;
  return code as ContentfulStatusCode;
}

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
    return c.json({ success: false, error: message }, errStatus(err));
  }
});

playlistRoutes.get('/export', async (_c) => {
  const file = await listPlaylists();
  const filename = `playlists-backup-${new Date().toISOString().slice(0, 10)}.json`;
  return new Response(JSON.stringify({ exportedAt: new Date().toISOString(), playlists: file }, null, 2), {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
});

playlistRoutes.post('/import-backup', async (c) => {
  const body = await c.req.json().catch(() => null);
  if (!body || typeof body.file !== 'string' || !body.file.trim()) {
    return c.json({ success: false, error: 'Envía el contenido del backup (JSON) en el campo "file".' }, 400);
  }
  try {
    const result = await importBackup(body.file);
    return c.json({
      success: true,
      data: result,
      message: `Backup restaurado: ${result.playlists} playlists con ${result.tracks} canciones. Se creó una copia de seguridad de los datos previos.`,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error al importar el backup.';
    return c.json({ success: false, error: message }, errStatus(err));
  }
});

playlistRoutes.delete('/:id', async (c) => {
  try {
    await deletePlaylist(c.req.param('id'));
    return c.json({ success: true, message: 'Playlist eliminada de la app.' });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error al eliminar.';
    return c.json({ success: false, error: message }, errStatus(err));
  }
});

playlistRoutes.post('/:id/sync-structure', async (c) => {
  try {
    const result = await syncStructure(c.req.param('id'));
    const parts: string[] = [];
    if (result.added > 0) parts.push(`${result.added} canciones nuevas importadas.`);
    if (result.removed > 0) {
      parts.push(
        `${result.removed} canciones ya no están en tu playlist de YouTube y se marcaron como "Fuera de playlist".`,
      );
    }
    const message =
      parts.length > 0 ? parts.join(' ') : 'La estructura está al día, no hay cambios.';
    return c.json({
      success: true,
      data: result,
      message,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error al sincronizar la estructura.';
    return c.json({ success: false, error: message }, errStatus(err));
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
    return c.json({ success: false, error: message }, errStatus(err));
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
    return c.json({ success: false, error: message }, errStatus(err));
  }
});

playlistRoutes.post('/:id/tracks/bulk', async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as {
    trackIds?: string[];
    title?: string;
    artist?: string;
  };
  try {
    const updated = await bulkUpdateTracks(c.req.param('id'), body.trackIds ?? [], {
      title: body.title,
      artist: body.artist,
    });
    return c.json({ success: true, data: { updated }, message: `${updated} canciones actualizadas.` });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error al actualizar.';
    return c.json({ success: false, error: message }, errStatus(err));
  }
});

playlistRoutes.delete('/:id/tracks/:trackId', async (c) => {
  try {
    const track = await removeTrackFromPlaylist(c.req.param('id'), c.req.param('trackId'));
    return c.json({
      success: true,
      data: { trackId: track.id },
      message: 'Canción eliminada de tu playlist de YouTube y del registro local.',
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error al eliminar la canción.';
    return c.json({ success: false, error: message }, errStatus(err));
  }
});

playlistRoutes.post('/:id/remove-damaged', async (c) => {
  try {
    const removed = await removeDamagedTracks(c.req.param('id'));
    return c.json({
      success: true,
      data: { removed },
      message: `${removed} canciones dañadas eliminadas de tu playlist de YouTube.`,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error al eliminar las dañadas.';
    return c.json({ success: false, error: message }, errStatus(err));
  }
});

playlistRoutes.patch('/:id/tracks/:trackId', async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as { title?: string; artist?: string };
  if (body.title === undefined && body.artist === undefined) {
    return c.json({ success: false, error: 'Envía "title" o "artist" para editar.' }, 400);
  }
  try {
    const track = await updateTrack(c.req.param('id'), c.req.param('trackId'), body);
    return c.json({ success: true, data: track, message: 'Datos actualizados.' });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error al actualizar.';
    return c.json({ success: false, error: message }, errStatus(err));
  }
});

export default playlistRoutes;