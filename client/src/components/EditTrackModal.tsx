import { useState } from 'preact/hooks';
import { api } from '../services/api';
import type { Track } from '../types';

interface Props {
  track: Track;
  playlistId: string;
  onClose: () => void;
  onSaved: () => void;
}

export default function EditTrackModal({ track, playlistId, onClose, onSaved }: Props) {
  const [artist, setArtist] = useState(track.artist);
  const [title, setTitle] = useState(track.title);
  const [saving, setSaving] = useState(false);
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
        artist: artist.trim(),
        title: title.trim(),
      });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar.');
      setSaving(false);
    }
  };

  return (
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div
        class="w-full max-w-sm rounded-xl border border-surface-700 bg-surface-900 p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div class="mb-4 flex items-start justify-between gap-3">
          <div>
            <h3 class="text-base font-semibold text-white">Editar mis datos</h3>
            <p class="mt-0.5 text-xs text-gray-500">Personaliza el nombre para organizar tu lista.</p>
          </div>
          <button onClick={onClose} class="rounded p-1 text-gray-500 transition hover:bg-surface-700 hover:text-white">
            ✕
          </button>
        </div>

        <div class="space-y-3">
          <div>
            <label for="edit-artist" class="mb-1 block text-xs font-medium text-gray-400">
              Artista
            </label>
            <input
              id="edit-artist"
              value={artist}
              onInput={(e) => setArtist((e.target as HTMLInputElement).value)}
              placeholder="Artista"
              class="w-full rounded-lg border border-surface-700 bg-surface-850 px-3 py-2 text-sm text-white outline-none focus:border-red-500"
            />
          </div>
          <div>
            <label for="edit-title" class="mb-1 block text-xs font-medium text-gray-400">
              Título de la canción
            </label>
            <input
              id="edit-title"
              value={title}
              onInput={(e) => setTitle((e.target as HTMLInputElement).value)}
              placeholder="Título"
              class="w-full rounded-lg border border-surface-700 bg-surface-850 px-3 py-2 text-sm text-white outline-none focus:border-red-500"
            />
          </div>
        </div>

        {error && (
          <div class="mt-3 rounded-lg border border-red-900/50 bg-red-950/40 px-3 py-2 text-sm text-red-300">
            {error}
          </div>
        )}

        <div class="mt-5 flex justify-end gap-2">
          <button
            onClick={onClose}
            class="rounded-lg border border-surface-700 bg-surface-800 px-4 py-2 text-sm font-medium text-gray-200 transition hover:bg-surface-700"
          >
            Cancelar
          </button>
          <button
            onClick={() => void save()}
            disabled={saving}
            class="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-500 disabled:opacity-60"
          >
            {saving ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  );
}