import type { Playlist } from '../types';

interface Props {
  playlist: Playlist;
  active: boolean;
  onSelect: () => void;
  onManage: () => void;
}

function countByStatus(playlist: Playlist, status: string): number {
  return playlist.tracks.filter((t) => t.status === status).length;
}

function playlistUrl(playlist: Playlist): string {
  return `https://www.youtube.com/playlist?list=${playlist.youtubePlaylistId}`;
}

export default function PlaylistCard({ playlist, active, onSelect, onManage }: Props) {
  const activeCount = countByStatus(playlist, 'active');
  const damaged = countByStatus(playlist, 'deleted') + countByStatus(playlist, 'unavailable');
  const privateCount = countByStatus(playlist, 'private');
  const unknown = countByStatus(playlist, 'unknown');
  const outOfPlaylist = countByStatus(playlist, 'out_of_playlist');

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
        <div class="flex items-center gap-1">
          <a
            href={playlistUrl(playlist)}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            title="Ir a la playlist en YouTube"
            class="rounded-lg bg-blue-600 p-2 text-white shadow transition hover:bg-blue-500"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              class="h-4 w-4"
            >
              <circle cx="12" cy="12" r="10" />
              <polygon points="10 8 16 12 10 16 10 8" />
            </svg>
          </a>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onManage();
            }}
            title="Gestión de la playlist: sincronizar, verificar estados, eliminar"
            class="rounded-lg p-1.5 text-gray-500 opacity-0 transition hover:bg-surface-700 hover:text-white group-hover:opacity-100"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              class="h-4 w-4"
            >
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </button>
        </div>
      </div>

      <div class="mt-3 flex flex-wrap gap-1.5 text-[11px]">
        {damaged > 0 && (
          <span class="rounded-full bg-red-950/70 px-2 py-0.5 font-medium text-red-300">{damaged} dañadas</span>
        )}
        {outOfPlaylist > 0 && (
          <span class="rounded-full bg-orange-950/70 px-2 py-0.5 font-medium text-orange-300">
            {outOfPlaylist} fuera de playlist
          </span>
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