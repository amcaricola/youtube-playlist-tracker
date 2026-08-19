import TrackItem from './TrackItem';
import type { Track } from '../types';

interface Props {
  tracks: Track[];
  onRecover: (track: Track) => void;
}

export default function TrackList({ tracks, onRecover }: Props) {
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
        <TrackItem key={track.id} track={track} onRecover={() => onRecover(track)} />
      ))}
    </ul>
  );
}