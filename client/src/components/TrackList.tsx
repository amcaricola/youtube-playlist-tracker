import TrackItem from './TrackItem';
import type { Track } from '../types';

interface Props {
  tracks: Track[];
  selectedIds: Set<string>;
  duplicateIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onRecover: (track: Track) => void;
  onEdit: (track: Track) => void;
  onDelete: (track: Track) => void;
}

export default function TrackList({
  tracks,
  selectedIds,
  duplicateIds,
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
    <ul class="space-y-2">
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
  );
}