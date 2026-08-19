import type { Track, TrackStatus } from '../types';

interface Props {
  track: Track;
  onRecover: () => void;
}

const STATUS_META: Record<TrackStatus, { label: string; classes: string }> = {
  active: { label: 'Activa', classes: 'bg-emerald-950/60 text-emerald-300' },
  unavailable: { label: 'No disponible', classes: 'bg-amber-950/60 text-amber-300' },
  private: { label: 'Privada', classes: 'bg-purple-950/60 text-purple-300' },
  deleted: { label: 'Eliminada', classes: 'bg-red-950/60 text-red-300' },
  unknown: { label: 'Sin verificar', classes: 'bg-gray-800 text-gray-400' },
};

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
}

function watchUrl(videoId: string): string {
  return `https://www.youtube.com/watch?v=${videoId}`;
}

export default function TrackItem({ track, onRecover }: Props) {
  const meta = STATUS_META[track.status] ?? STATUS_META.unknown;
  const damaged = track.status === 'deleted' || track.status === 'unavailable';

  return (
    <li
      class={`group flex items-center gap-3 rounded-xl border p-3 transition ${
        damaged
          ? 'border-red-900/50 bg-red-950/20 hover:bg-red-950/30'
          : 'border-surface-800 bg-surface-900 hover:bg-surface-850'
      }`}
    >
      <div class="relative shrink-0">
        {track.thumbnailUrl ? (
          <img
            src={track.thumbnailUrl}
            alt=""
            class="h-12 w-20 rounded-md object-cover"
            loading="lazy"
          />
        ) : (
          <div class="flex h-12 w-20 items-center justify-center rounded-md bg-surface-700 text-lg">🎵</div>
        )}
        <a
          href={watchUrl(track.youtubeVideoId)}
          target="_blank"
          rel="noopener noreferrer"
          title="Reproducir en YouTube"
          class="absolute inset-0 flex items-center justify-center rounded-md bg-black/70 text-lg opacity-0 transition group-hover:opacity-100"
        >
          ▶
        </a>
      </div>

      <div class="min-w-0 flex-1">
        <p class="truncate text-sm font-semibold text-white">
          {track.artist ? (
            <>
              <span class="text-gray-400">{track.artist}</span>
              {' · '}
            </>
          ) : null}
          {track.title}
        </p>
        <p class="truncate text-xs text-gray-500">
          Revisada: {formatDate(track.lastCheckedAt)}
          {track.channelTitle ? ` · ${track.channelTitle}` : ''}
        </p>
      </div>

      <div class="flex shrink-0 flex-col items-end gap-2">
        <span class={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${meta.classes}`}>{meta.label}</span>
        {damaged && (
          <button
            onClick={onRecover}
            class="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-red-500"
          >
            Recuperar canción
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
      </div>
    </li>
  );
}