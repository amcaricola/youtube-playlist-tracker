import type { Playlist } from '../types';

interface Props {
  playlist: Playlist;
  syncingStructure: boolean;
  syncing: boolean;
  deleting: boolean;
  onSyncStructure: () => void;
  onVerifyStates: () => void;
  onDelete: () => void;
  onClose: () => void;
}

export default function PlaylistManageModal({
  playlist,
  syncingStructure,
  syncing,
  deleting,
  onSyncStructure,
  onVerifyStates,
  onDelete,
  onClose,
}: Props) {
  return (
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        class="w-full max-w-sm rounded-xl border border-surface-700 bg-surface-900 p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div class="mb-4 flex items-center justify-between gap-3">
          <div class="min-w-0">
            <h2 class="text-sm font-semibold text-white">Gestión de playlist</h2>
            <p class="mt-0.5 truncate text-xs text-gray-500">{playlist.title}</p>
          </div>
          <button onClick={onClose} class="text-gray-400 transition hover:text-white" title="Cerrar">
            ✕
          </button>
        </div>

        <div class="space-y-2">
          <button
            onClick={onSyncStructure}
            disabled={syncingStructure}
            title="Detecta canciones nuevas añadidas directamente en YouTube y marca como 'Fuera de playlist' las que ya no están"
            class="w-full rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:opacity-60"
          >
            {syncingStructure ? 'Sincronizando…' : 'Sincronizar playlist'}
          </button>

          <button
            onClick={onVerifyStates}
            disabled={syncing}
            title="Revisa el estado (activa / eliminada / privada / no disponible) de todas las canciones guardadas"
            class="w-full rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:opacity-60"
          >
            {syncing ? 'Verificando…' : 'Verificar estados'}
          </button>

          <button
            onClick={onDelete}
            disabled={deleting}
            title="Eliminar la playlist de la app (no se toca tu playlist en YouTube)"
            class="w-full rounded-lg border border-red-900/50 bg-red-950/40 px-3 py-2 text-sm font-medium text-red-300 transition hover:bg-red-950/70 disabled:opacity-60"
          >
            {deleting ? 'Eliminando…' : 'Eliminar playlist'}
          </button>
        </div>
      </div>
    </div>
  );
}