import { isGenericPlaceholder } from './trackUtils';
import type { Track, TrackStatus } from '../types';

interface Props {
  track: Track;
  selected: boolean;
  isDuplicate: boolean;
  onToggleSelect: () => void;
  onRecover: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

export const GRID_COLS =
  'grid-cols-[2.25rem_4.5rem_minmax(0,1fr)_minmax(0,1fr)_10rem]';

const STATUS_META: Record<TrackStatus, { label: string; classes: string }> = {
  active: { label: 'Activa', classes: 'bg-emerald-950/60 text-emerald-300' },
  unavailable: { label: 'No disponible', classes: 'bg-amber-950/60 text-amber-300' },
  private: { label: 'Privada', classes: 'bg-purple-950/60 text-purple-300' },
  deleted: { label: 'Eliminada', classes: 'bg-red-950/60 text-red-300' },
  unknown: { label: 'Sin verificar', classes: 'bg-gray-800 text-gray-400' },
};

function watchUrl(videoId: string): string {
  return `https://www.youtube.com/watch?v=${videoId}`;
}

export default function TrackItem({ track, selected, isDuplicate, onToggleSelect, onRecover, onEdit, onDelete }: Props) {
  const meta = STATUS_META[track.status] ?? STATUS_META.unknown;
  const damaged = track.status === 'deleted' || track.status === 'unavailable';

  return (
    <li
      class={`group grid ${GRID_COLS} items-center gap-3 px-3 py-2 transition ${
        selected
          ? 'bg-blue-950/30'
          : damaged
            ? 'bg-red-950/20 hover:bg-red-950/30'
            : 'hover:bg-surface-850'
      }`}
    >
      <span
        class={`relative inline-block h-4 w-4 shrink-0 transition ${
          selected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
        }`}
      >
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggleSelect}
          title="Seleccionar para edición masiva"
          class="peer absolute inset-0 h-full w-full cursor-pointer appearance-none rounded border border-surface-600 bg-surface-800 transition hover:border-blue-500 checked:border-blue-500 checked:bg-blue-600"
        />
        <svg
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          stroke-width="2.5"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="pointer-events-none absolute inset-0 m-auto h-3 w-3 text-white opacity-0 transition peer-checked:opacity-100"
        >
          <path d="M3.5 8.5l3 3 6-6" />
        </svg>
      </span>

      <div class="relative h-10 w-16 shrink-0">
        {track.thumbnailUrl ? (
          <img
            src={track.thumbnailUrl}
            alt=""
            class="h-10 w-16 rounded object-cover"
            loading="lazy"
          />
        ) : (
          <div class="flex h-10 w-16 items-center justify-center rounded bg-surface-700 text-sm">🎵</div>
        )}
        <a
          href={watchUrl(track.youtubeVideoId)}
          target="_blank"
          rel="noopener noreferrer"
          title="Reproducir en YouTube"
          class="absolute inset-0 flex items-center justify-center rounded bg-black/70 text-base opacity-0 transition group-hover:opacity-100"
        >
          ▶
        </a>
      </div>

      <p class="min-w-0 truncate text-sm font-semibold text-white" title={track.title}>
        {track.title}
      </p>

      <p class="min-w-0 truncate text-sm text-gray-400" title={track.artist}>
        {track.artist || '—'}
      </p>

      <div class="flex shrink-0 flex-col items-end gap-1.5">
        <div class="flex items-center gap-1.5">
          {isDuplicate && (
            <span
              class="rounded-full bg-orange-950/60 px-2.5 py-0.5 text-[11px] font-medium text-orange-300"
              title="Hay otra canción con el mismo título (posible cover o duplicado)"
            >
              Duplicada
            </span>
          )}
          <span class={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${meta.classes}`}>{meta.label}</span>
        </div>
        <div class="flex items-center gap-1.5">
          <button
            onClick={onEdit}
            title="Editar artista / título"
            class="rounded-lg border border-surface-700 bg-surface-800 px-2.5 py-1.5 text-xs font-medium text-gray-200 opacity-0 transition hover:bg-surface-700 group-hover:opacity-100"
          >
            ✏️
          </button>
          {damaged && (
            <button
              onClick={onRecover}
              class="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-blue-500"
            >
              Recuperar
            </button>
          )}
          {track.status === 'unknown' && (
            <button
              onClick={onRecover}
              class="rounded-lg border border-surface-700 bg-surface-800 px-3 py-1.5 text-xs font-medium text-gray-200 transition hover:bg-surface-700"
            >
              Verificar
            </button>
          )}
          {damaged && isGenericPlaceholder(track) && (
            <button
              onClick={onDelete}
              title="Eliminar de la playlist de YouTube (no se puede recuperar)"
              class="rounded-lg border border-red-900/50 bg-red-950/40 px-2.5 py-1.5 text-xs font-medium text-red-300 transition hover:bg-red-950/70"
            >
              🗑
            </button>
          )}
        </div>
      </div>
    </li>
  );
}