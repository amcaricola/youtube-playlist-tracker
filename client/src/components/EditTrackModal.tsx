import { useState } from 'preact/hooks';
import { api } from '../services/api';
import type { Track } from '../types';

interface Props {
  track: Track;
  playlistId: string;
  isDuplicate: boolean;
  onClose: () => void;
  onSaved: () => void;
  onDeleted: () => void;
}

export default function EditTrackModal({ track, playlistId, isDuplicate, onClose, onSaved, onDeleted }: Props) {
  const [title, setTitle] = useState(track.title);
  const [artist, setArtist] = useState(track.artist);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  const save = async () => {
    if (!title.trim()) {
      setError('El título no puede quedar vacío.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await api.patch(`/api/playlists/${playlistId}/tracks/${track.id}`, {
        title: title.trim(),
        artist: artist.trim(),
      });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar.');
      setSaving(false);
    }
  };

  const remove = async () => {
    const confirmMsg =
      track.status === 'out_of_playlist'
        ? '¿Eliminar esta canción del registro local? Ya no está en tu playlist de YouTube.'
        : '¿Eliminar esta canción de tu playlist de YouTube y del registro local?';
    if (!window.confirm(confirmMsg)) return;
    setDeleting(true);
    setError('');
    try {
      await api.delete(`/api/playlists/${playlistId}/tracks/${track.id}`);
      onDeleted();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al eliminar.');
      setDeleting(false);
    }
  };

  return (
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
        class="w-full max-w-sm rounded-xl border border-surface-700 bg-surface-900 p-5"
      >
        <div class="mb-4 flex items-start justify-between gap-3">
          <div>
            <h3 class="text-base font-semibold text-white">Editar mis datos</h3>
            <p class="mt-0.5 text-xs text-gray-500">Personaliza el nombre para organizar tu lista.</p>
          </div>
          <button type="button" onClick={onClose} class="rounded p-1 text-gray-500 transition hover:bg-surface-700 hover:text-white">
            ✕
          </button>
        </div>

        <div class="space-y-3">
          <div>
            <label for="edit-title" class="mb-1 block text-xs font-medium text-gray-400">
              Título de la canción
            </label>
            <input
              id="edit-title"
              value={title}
              onInput={(e) => setTitle((e.target as HTMLInputElement).value)}
              placeholder="Título"
              class="w-full rounded-lg border border-surface-700 bg-surface-850 px-3 py-2 text-sm text-white outline-none focus:border-blue-500"
            />
          </div>
          <div>
            <label for="edit-artist" class="mb-1 block text-xs font-medium text-gray-400">
              Artista
            </label>
            <input
              id="edit-artist"
              value={artist}
              onInput={(e) => setArtist((e.target as HTMLInputElement).value)}
              placeholder="Artista"
              class="w-full rounded-lg border border-surface-700 bg-surface-850 px-3 py-2 text-sm text-white outline-none focus:border-blue-500"
            />
          </div>
        </div>

        {isDuplicate && (
          <p class="mt-3 rounded-lg border border-orange-900/50 bg-orange-950/30 px-3 py-2 text-sm text-orange-200">
            Esta canción está marcada como duplicada. Si prefieres quitarla de la playlist, puedes eliminarla aquí.
          </p>
        )}

        {error && (
          <div class="mt-3 rounded-lg border border-red-900/50 bg-red-950/40 px-3 py-2 text-sm text-red-300">
            {error}
          </div>
        )}

        <div class="mt-5 flex items-center justify-between gap-2">
          {isDuplicate ? (
            <button
              type="button"
              onClick={() => void remove()}
              disabled={deleting}
              title="Eliminar esta canción de la playlist de YouTube y del registro local"
              class="rounded-lg border border-red-900/50 bg-red-950/40 px-4 py-2 text-sm font-medium text-red-300 transition hover:bg-red-950/70 disabled:opacity-60"
            >
              {deleting ? 'Eliminando…' : 'Eliminar de la playlist'}
            </button>
          ) : (
            <span />
          )}
          <div class="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              class="rounded-lg border border-surface-700 bg-surface-800 px-4 py-2 text-sm font-medium text-gray-200 transition hover:bg-surface-700"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              class="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:opacity-60"
            >
              {saving ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}