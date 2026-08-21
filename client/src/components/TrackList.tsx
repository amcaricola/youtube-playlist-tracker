import TrackItem, { GRID_COLS } from './TrackItem';
import type { Track } from '../types';

export type SortKey = 'none' | 'title' | 'artist';
export type SortDir = 'asc' | 'desc';

interface Props {
  tracks: Track[];
  selectedIds: Set<string>;
  duplicateIds: Set<string>;
  sortKey: SortKey;
  sortDir: SortDir;
  onToggleSort: (key: 'title' | 'artist') => void;
  onToggleSelect: (id: string) => void;
  onRecover: (track: Track) => void;
  onEdit: (track: Track) => void;
  onDelete: (track: Track) => void;
}

function SortHeader({
  label,
  active,
  dir,
  onClick,
}: {
  label: string;
  active: boolean;
  dir: SortDir;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      title="Haz clic: ascendente → descendente → sin orden"
      class={`flex items-center gap-1 text-left text-[11px] font-semibold uppercase tracking-wide transition hover:text-white ${
        active ? 'text-blue-400' : 'text-gray-400'
      }`}
    >
      {label}
      <span class="text-[10px]">{active ? (dir === 'asc' ? '▲' : '▼') : '↕'}</span>
    </button>
  );
}

export default function TrackList({
  tracks,
  selectedIds,
  duplicateIds,
  sortKey,
  sortDir,
  onToggleSort,
  onToggleSelect,
  onRecover,
  onEdit,
  onDelete,
}: Props) {
  if (tracks.length === 0) {
    return (
      <div class="rounded-xl border border-dashed border-surface-700 bg-surface-900/50 p-8 text-center text-sm text-gray-500">
        No hay canciones que coincidan con los filtros.
      </div>
    );
  }

  return (
    <div class="rounded-xl border border-surface-800 bg-surface-900">
      <div
        class={`sticky top-0 z-20 grid ${GRID_COLS} items-center gap-3 border-b border-surface-700 bg-surface-900 px-3 py-2`}
      >
        <span />
        <span />
        <SortHeader label="Título" active={sortKey === 'title'} dir={sortDir} onClick={() => onToggleSort('title')} />
        <SortHeader label="Artista" active={sortKey === 'artist'} dir={sortDir} onClick={() => onToggleSort('artist')} />
        <span class="text-right text-[11px] font-semibold uppercase tracking-wide text-gray-400">Estado</span>
      </div>

      <ul class="divide-y divide-surface-800">
        {tracks.map((track) => (
          <TrackItem
            key={track.id}
            track={track}
            selected={selectedIds.has(track.id)}
            isDuplicate={duplicateIds.has(track.id)}
            onToggleSelect={() => onToggleSelect(track.id)}
            onRecover={() => onRecover(track)}
            onEdit={() => onEdit(track)}
            onDelete={() => onDelete(track)}
          />
        ))}
      </ul>
    </div>
  );
}