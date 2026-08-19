import { useEffect, useState } from 'preact/hooks';
import { api } from '../services/api';
import { buildSearchQuery } from './queryUtils';
import type { SearchResult, Track } from '../types';

interface Props {
  track: Track;
  playlistId: string;
  onClose: () => void;
  onReplaced: () => void;
}

export default function RecoveryModal({ track, playlistId, onClose, onReplaced }: Props) {
  const [query, setQuery] = useState(() => buildSearchQuery(track.artist, track.title));
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [replacing, setReplacing] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);

  const doSearch = async (q: string) => {
    if (!q.trim()) {
      setError('La búsqueda está vacía.');
      return;
    }
    setLoading(true);
    setError('');
    setResults([]);
    setSearched(true);
    try {
      const res = await api.get<SearchResult[]>(`/api/youtube/search?q=${encodeURIComponent(q)}`);
      setResults(res.data ?? []);
      if (!res.data || res.data.length === 0) {
        setError('No se encontraron resultados. Prueba con otra búsqueda.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al buscar.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void doSearch(buildSearchQuery(track.artist, track.title));
  }, [track]);

  const replace = async (result: SearchResult) => {
    setReplacing(result.videoId);
    setError('');
    try {
      await api.post('/api/playlists/replace-track', {
        playlistId,
        trackId: track.id,
        newVideoId: result.videoId,
      });
      onReplaced();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al reemplazar.');
      setReplacing(null);
    }
  };

  return (
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div
        class="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-xl border border-surface-700 bg-surface-900 p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div class="mb-4 flex items-start justify-between gap-3">
          <div>
            <h3 class="text-base font-semibold text-white">Recuperar canción</h3>
            <p class="mt-0.5 text-xs text-gray-500">
              {track.artist ? `${track.artist} — ` : ''}
              {track.title}
            </p>
          </div>
          <button
            onClick={onClose}
            class="rounded p-1 text-gray-500 transition hover:bg-surface-700 hover:text-white"
          >
            ✕
          </button>
        </div>

        <div class="mb-4 flex gap-2">
          <input
            value={query}
            onInput={(e) => setQuery((e.target as HTMLInputElement).value)}
            onKeyDown={(e) => e.key === 'Enter' && void doSearch(query)}
            class="flex-1 rounded-lg border border-surface-700 bg-surface-850 px-3 py-2 text-sm text-white outline-none focus:border-red-500"
          />
          <button
            onClick={() => void doSearch(query)}
            disabled={loading}
            class="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-500 disabled:opacity-60"
          >
            {loading ? 'Buscando…' : 'Buscar'}
          </button>
        </div>

        {error && (
          <div class="mb-3 rounded-lg border border-red-900/50 bg-red-950/40 px-3 py-2 text-sm text-red-300">
            {error}
          </div>
        )}

        {results.length > 0 && (
          <ul class="space-y-2">
            {results.map((r) => (
              <li
                key={r.videoId}
                class="flex items-center gap-3 rounded-lg border border-surface-800 bg-surface-850 p-2.5"
              >
                <img src={r.thumbnailUrl} alt="" class="h-11 w-16 shrink-0 rounded object-cover" loading="lazy" />
                <div class="min-w-0 flex-1">
                  <p class="line-clamp-2 text-sm text-white">{r.title}</p>
                  <p class="text-xs text-gray-500">{r.channelTitle}</p>
                </div>
                <button
                  onClick={() => void replace(r)}
                  disabled={replacing !== null}
                  class="shrink-0 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-60"
                >
                  {replacing === r.videoId ? 'Reemplazando…' : 'Usar este'}
                </button>
              </li>
            ))}
          </ul>
        )}

        {!loading && searched && results.length === 0 && !error && (
          <p class="text-sm text-gray-500">Sin resultados.</p>
        )}
      </div>
    </div>
  );
}