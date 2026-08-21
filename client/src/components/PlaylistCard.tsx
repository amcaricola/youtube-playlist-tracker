import type { Playlist } from '../types';

interface Props {
  playlist: Playlist;
  active: boolean;
  onSelect: () => void;
  onDelete: () => void;
}

function countByStatus(playlist: Playlist, status: string): number {
  return playlist.tracks.filter((t) => t.status === status).length;
}

export default function PlaylistCard({ playlist, active, onSelect, onDelete }: Props) {
  const activeCount = countByStatus(playlist, 'active');
  const damaged = countByStatus(playlist, 'deleted') + countByStatus(playlist, 'unavailable');
  const privateCount = countByStatus(playlist, 'private');
  const unknown = countByStatus(playlist, 'unknown');

  return (
    <div
      onClick={onSelect}
      class={`group cursor-pointer rounded-xl border p-4 transition ${
        active
          ? 'border-blue-500/60 bg-surface-800'
          : 'border-surface-800 bg-surface-900 hover:border-surface-700 hover:bg-surface-850'
      }`}
    >
      <div class="flex items-start justify-between gap-2">
        <div class="flex items-center gap-3">
          {playlist.thumbnailUrl ? (
            <img
              src={playlist.thumbnailUrl}
              alt=""
              class="h-11 w-11 rounded-lg object-cover"
              loading="lazy"
            />
          ) : (
            <div class="flex h-11 w-11 items-center justify-center rounded-lg bg-surface-700 text-lg">📄</div>
          )}
          <div>
            <h3 class="line-clamp-1 text-sm font-semibold text-white">{playlist.title}</h3>
            <p class="text-xs text-gray-500">
              {playlist.tracks.length} canciones · {playlist.channelTitle}
            </p>
          </div>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          title="Eliminar de la app"
          class="rounded p-1 text-gray-500 opacity-0 transition hover:bg-surface-700 hover:text-red-400 group-hover:opacity-100"
        >
          ✕
        </button>
      </div>

      <div class="mt-3 flex flex-wrap gap-1.5 text-[11px]">
        {damaged > 0 && (
          <span class="rounded-full bg-red-950/70 px-2 py-0.5 font-medium text-red-300">{damaged} dañadas</span>
        )}
        {privateCount > 0 && (
          <span class="rounded-full bg-purple-950/70 px-2 py-0.5 font-medium text-purple-300">
            {privateCount} privadas
          </span>
        )}
        {unknown > 0 && (
          <span class="rounded-full bg-gray-800 px-2 py-0.5 font-medium text-gray-400">{unknown} sin verificar</span>
        )}
        <span class="rounded-full bg-emerald-950/60 px-2 py-0.5 font-medium text-emerald-300">
          {activeCount} activas
        </span>
      </div>
    </div>
  );
}