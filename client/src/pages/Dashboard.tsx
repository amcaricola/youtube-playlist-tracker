import { useEffect, useMemo, useState } from 'preact/hooks';
import Navbar from '../components/Navbar';
import PlaylistCard from '../components/PlaylistCard';
import SearchAndFilters from '../components/SearchAndFilters';
import TrackList from '../components/TrackList';
import RecoveryModal from '../components/RecoveryModal';
import { api, clearAuth } from '../services/api';
import { showToast } from '../components/Toaster';
import type { OAuthStatus, Playlist, SessionSummary, Track } from '../types';

interface Props {
  onLogout: () => void;
}

export default function Dashboard({ onLogout }: Props) {
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [importUrl, setImportUrl] = useState('');
  const [importing, setImporting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [query, setQuery] = useState('');
  const [artistFilter, setArtistFilter] = useState('');
  const [recoveryTrack, setRecoveryTrack] = useState<Track | null>(null);
  const [oauth, setOauth] = useState<OAuthStatus | null>(null);
  const [session, setSession] = useState<SessionSummary | null>(null);

  const selected = playlists.find((p) => p.id === selectedId) ?? playlists[0] ?? null;

  const loadAll = async () => {
    const [pl, oa, ss] = await Promise.all([
      api.get<Playlist[]>('/api/playlists'),
      api.get<OAuthStatus>('/api/youtube/oauth/status'),
      api.get<SessionSummary>('/api/auth/session'),
    ]);
    setPlaylists(pl.data ?? []);
    setOauth(oa.data ?? null);
    setSession(ss.data ?? null);
    if (selectedId === null && pl.data && pl.data.length > 0) {
      setSelectedId(pl.data[0].id);
    }
  };

  useEffect(() => {
    const boot = async () => {
      try {
        await loadAll();
      } catch (err) {
        showToast(err instanceof Error ? err.message : 'Error al cargar datos.');
      } finally {
        setLoading(false);
      }
    };
    void boot();
  }, []);

  const artists = useMemo(() => {
    if (!selected) return [];
    const set = new Set<string>();
    for (const t of selected.tracks) {
      if (t.artist) set.add(t.artist);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [selected]);

  const filteredTracks = useMemo(() => {
    if (!selected) return [];
    const q = query.trim().toLowerCase();
    return selected.tracks.filter((t) => {
      if (artistFilter && t.artist !== artistFilter) return false;
      if (q && !t.title.toLowerCase().includes(q) && !t.artist.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [selected, query, artistFilter]);

  const importPlaylist = async () => {
    if (!importUrl.trim()) {
      showToast('Ingresa la URL o ID de una playlist.');
      return;
    }
    setImporting(true);
    try {
      const res = await api.post<Playlist>('/api/playlists/import', { playlistUrl: importUrl.trim() });
      showToast(res.message ?? 'Playlist importada.');
      setImportUrl('');
      await loadAll();
      setSelectedId(res.data?.id ?? null);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Error al importar.');
    } finally {
      setImporting(false);
    }
  };

  const deletePlaylist = async (id: string) => {
    if (!window.confirm('¿Eliminar esta playlist de la app? (no se toca tu playlist en YouTube)')) return;
    try {
      await api.delete(`/api/playlists/${id}`);
      showToast('Playlist eliminada.');
      setSelectedId(null);
      await loadAll();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Error al eliminar.');
    }
  };

  const syncPlaylist = async (force = false) => {
    if (!selected) return;
    setSyncing(true);
    try {
      const res = await api.post<{ checked: number; updated: number }>(
        `/api/playlists/${selected.id}/sync`,
        { force },
      );
      showToast(res.message ?? 'Sincronización completada.');
      await loadAll();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Error al sincronizar.');
    } finally {
      setSyncing(false);
    }
  };

  const logout = async () => {
    try {
      await api.post('/api/auth/logout');
    } catch {
      /* ignorar */
    }
    clearAuth();
    onLogout();
  };

  const openOAuth = async () => {
    try {
      const res = await api.get<{ url: string }>('/api/youtube/oauth/url');
      if (res.data) window.location.href = res.data.url;
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'No se pudo iniciar OAuth.');
    }
  };

  const disconnectOAuth = async () => {
    try {
      await api.post('/api/youtube/oauth/disconnect');
      showToast('YouTube desconectado.');
      await loadAll();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Error al desconectar.');
    }
  };

  const handleReplaced = async () => {
    showToast('Canción reemplazada correctamente.');
    setRecoveryTrack(null);
    await loadAll();
  };

  if (loading) {
    return (
      <div class="flex min-h-screen items-center justify-center bg-surface-950 text-sm text-gray-400">
        Cargando…
      </div>
    );
  }

  return (
    <div class="min-h-screen bg-surface-950 pb-16">
      <Navbar
        oauth={oauth}
        session={session}
        onOpenOAuth={openOAuth}
        onDisconnectOAuth={disconnectOAuth}
        onLogout={logout}
      />

      <main class="mx-auto max-w-6xl px-4 py-6">
        <section class="mb-6 rounded-xl border border-surface-800 bg-surface-900 p-4">
          <h2 class="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-400">
            Importar playlist
          </h2>
          <div class="flex flex-col gap-2 sm:flex-row">
            <input
              value={importUrl}
              onInput={(e) => setImportUrl((e.target as HTMLInputElement).value)}
              onKeyDown={(e) => e.key === 'Enter' && void importPlaylist()}
              placeholder="https://www.youtube.com/playlist?list=…  o  solo el ID"
              class="flex-1 rounded-lg border border-surface-700 bg-surface-850 px-4 py-2.5 text-sm text-white placeholder-gray-500 outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500"
            />
            <button
              onClick={() => void importPlaylist()}
              disabled={importing}
              class="rounded-lg bg-red-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-red-500 disabled:opacity-60"
            >
              {importing ? 'Importando…' : 'Importar'}
            </button>
          </div>
        </section>

        {playlists.length === 0 ? (
          <div class="rounded-xl border border-dashed border-surface-700 bg-surface-900/50 p-10 text-center text-gray-400">
            <p class="mb-1 text-lg font-medium text-gray-300">Aún no hay playlists</p>
            <p class="text-sm">Importa tu primera playlist con el enlace o ID de YouTube.</p>
          </div>
        ) : (
          <>
            <section class="mb-6">
              <h2 class="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-400">
                Mis playlists
              </h2>
              <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {playlists.map((p) => (
                  <PlaylistCard
                    key={p.id}
                    playlist={p}
                    active={p.id === selected?.id}
                    onSelect={() => setSelectedId(p.id)}
                    onDelete={() => void deletePlaylist(p.id)}
                  />
                ))}
              </div>
            </section>

            {selected && (
              <section class="space-y-4">
                <div class="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 class="text-lg font-semibold text-white">{selected.title}</h2>
                    <p class="text-xs text-gray-500">
                      {selected.tracks.length} canciones · Canal: {selected.channelTitle}
                    </p>
                  </div>
                  <div class="flex gap-2">
                    <button
                      onClick={() => void syncPlaylist(true)}
                      disabled={syncing}
                      class="rounded-lg border border-surface-700 bg-surface-800 px-4 py-2 text-sm font-medium text-gray-200 transition hover:bg-surface-700 disabled:opacity-60"
                    >
                      {syncing ? 'Verificando…' : 'Verificar ahora'}
                    </button>
                  </div>
                </div>

                <SearchAndFilters
                  query={query}
                  onQuery={setQuery}
                  artists={artists}
                  artistFilter={artistFilter}
                  onArtistFilter={setArtistFilter}
                  total={selected.tracks.length}
                  shown={filteredTracks.length}
                />

                <TrackList
                  tracks={filteredTracks}
                  onRecover={(t) => setRecoveryTrack(t)}
                />
              </section>
            )}
          </>
        )}
      </main>

      {recoveryTrack && selected && (
        <RecoveryModal
          track={recoveryTrack}
          playlistId={selected.id}
          onClose={() => setRecoveryTrack(null)}
          onReplaced={() => void handleReplaced()}
        />
      )}
    </div>
  );
}