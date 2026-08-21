import { useEffect, useMemo, useState } from 'preact/hooks';
import Navbar from '../components/Navbar';
import PlaylistCard from '../components/PlaylistCard';
import SearchAndFilters from '../components/SearchAndFilters';
import TrackList from '../components/TrackList';
import RecoveryModal from '../components/RecoveryModal';
import EditTrackModal from '../components/EditTrackModal';
import ImportModal from '../components/ImportModal';
import Pagination from '../components/Pagination';
import { api, clearAuth, getToken } from '../services/api';
import { showToast } from '../components/Toaster';
import { isDamaged, isGenericPlaceholder, normalizeTitle } from '../components/trackUtils';
import type { OAuthStatus, Playlist, SessionSummary, Track } from '../types';

const PAGE_SIZE = 50;

interface Props {
  onLogout: () => void;
}

export default function Dashboard({ onLogout }: Props) {
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncingStructure, setSyncingStructure] = useState(false);
  const [query, setQuery] = useState('');
  const [artistFilter, setArtistFilter] = useState('');
  const [damagedOnly, setDamagedOnly] = useState(false);
  const [duplicatesOnly, setDuplicatesOnly] = useState(false);
  const [sortKey, setSortKey] = useState<'none' | 'title' | 'artist'>('none');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(1);
  const [selectedTrackIds, setSelectedTrackIds] = useState<Set<string>>(new Set());
  const [bulkArtist, setBulkArtist] = useState('');
  const [bulkSaving, setBulkSaving] = useState(false);
  const [recoveryTrack, setRecoveryTrack] = useState<Track | null>(null);
  const [editingTrack, setEditingTrack] = useState<Track | null>(null);
  const [oauth, setOauth] = useState<OAuthStatus | null>(null);
  const [session, setSession] = useState<SessionSummary | null>(null);

  const selected = playlists.find((p) => p.id === selectedId) ?? playlists[0] ?? null;

  const loadAll = async () => {
    const [pl, oa, ss] = await Promise.allSettled([
      api.get<Playlist[]>('/api/playlists'),
      api.get<OAuthStatus>('/api/youtube/oauth/status'),
      api.get<SessionSummary>('/api/auth/session'),
    ]);
    if (pl.status === 'fulfilled') {
      setPlaylists(pl.value.data ?? []);
      if (selectedId === null && pl.value.data && pl.value.data.length > 0) {
        setSelectedId(pl.value.data[0].id);
      }
    }
    if (oa.status === 'fulfilled') setOauth(oa.value.data ?? null);
    if (ss.status === 'fulfilled') setSession(ss.value.data ?? null);
  };

  const refreshOAuth = async () => {
    try {
      const res = await api.get<OAuthStatus>('/api/youtube/oauth/status');
      setOauth(res.data ?? null);
    } catch {
      /* mantener estado */
    }
  };

  useEffect(() => {
    const handler = (e: MessageEvent) => {
      const payload = (e.data ?? {}) as { type?: string; status?: string };
      if (payload.type !== 'YPT_OAUTH') return;
      if (payload.status === 'connected') {
        showToast('YouTube conectado correctamente.');
      } else if (payload.status === 'failed') {
        showToast('No se pudo conectar con YouTube.');
      } else {
        showToast('OAuth finalizado.');
      }
      void refreshOAuth();
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

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

  const duplicateIds = useMemo(() => {
    if (!selected) return new Set<string>();
    const counts = new Map<string, number>();
    const keyOf = (t: Track) => `${normalizeTitle(t.title)}|${normalizeTitle(t.artist)}`;
    for (const t of selected.tracks) {
      if (isGenericPlaceholder(t)) continue;
      const key = keyOf(t);
      if (!normalizeTitle(t.title)) continue;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    const dup = new Set<string>();
    for (const t of selected.tracks) {
      const key = keyOf(t);
      if (key && (counts.get(key) ?? 0) > 1) dup.add(t.id);
    }
    return dup;
  }, [selected]);

  const toggleSort = (key: 'title' | 'artist') => {
    if (sortKey !== key) {
      setSortKey(key);
      setSortDir('asc');
    } else if (sortDir === 'asc') {
      setSortDir('desc');
    } else {
      setSortKey('none');
      setSortDir('asc');
    }
  };

  const filteredTracks = useMemo(() => {
    if (!selected) return [];
    const q = query.trim().toLowerCase();
    const result = selected.tracks.filter((t) => {
      if (artistFilter && t.artist !== artistFilter) return false;
      if (damagedOnly && t.status !== 'deleted' && t.status !== 'unavailable') return false;
      if (duplicatesOnly && !duplicateIds.has(t.id)) return false;
      if (q && !t.title.toLowerCase().includes(q) && !t.artist.toLowerCase().includes(q)) return false;
      return true;
    });

    if (sortKey !== 'none') {
      const dir = sortDir === 'asc' ? 1 : -1;
      const field = sortKey === 'title' ? 'title' : 'artist';
      result.sort((a, b) => {
        const cmp = a[field].toLowerCase().localeCompare(b[field].toLowerCase());
        return cmp * dir;
      });
    }
    return result;
  }, [selected, query, artistFilter, damagedOnly, duplicatesOnly, duplicateIds, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filteredTracks.length / PAGE_SIZE));
  const pagedTracks = filteredTracks.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => {
    setPage(1);
  }, [selectedId, query, artistFilter, damagedOnly, duplicatesOnly]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const importPlaylist = async (url: string): Promise<boolean> => {
    if (!url.trim()) {
      showToast('Ingresa la URL o ID de una playlist.');
      return false;
    }
    setImporting(true);
    try {
      const res = await api.post<Playlist>('/api/playlists/import', { playlistUrl: url.trim() });
      showToast(res.message ?? 'Playlist importada.');
      await loadAll();
      setSelectedId(res.data?.id ?? null);
      return true;
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Error al importar.');
      return false;
    } finally {
      setImporting(false);
    }
  };

  const verifyDuplicates = () => {
    const n = duplicateIds.size;
    showToast(
      n > 0
        ? `Duplicados actualizados: ${n} canciones comparten el mismo título y artista.`
        : 'No hay canciones duplicadas (mismo título y artista).',
    );
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
      if (!res.data) return;
      const popup = window.open(res.data.url, 'youtube-oauth', 'width=540,height=680');
      if (!popup) {
        window.location.href = res.data.url;
      }
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

  const handleTrackEdited = async () => {
    showToast('Datos actualizados.');
    setEditingTrack(null);
    await loadAll();
  };

  const lostCount = useMemo(
    () =>
      selected
        ? selected.tracks.filter((t) => isDamaged(t.status) && isGenericPlaceholder(t)).length
        : 0,
    [selected],
  );

  const deleteTrack = async (track: Track) => {
    if (!selected) return;
    if (!window.confirm('¿Eliminar esta canción de tu playlist de YouTube y del registro local?')) return;
    try {
      const res = await api.delete(`/api/playlists/${selected.id}/tracks/${track.id}`);
      showToast(res.message ?? 'Canción eliminada.');
      await loadAll();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Error al eliminar la canción.');
    }
  };

  const removeDamaged = async () => {
    if (!selected || lostCount === 0) return;
    if (
      !window.confirm(
        `¿Eliminar las ${lostCount} canciones dañadas SIN DATOS de tu playlist de YouTube? ` +
          'Solo se borran las que no tienen título/artista guardado y no pueden recuperarse.',
      )
    ) {
      return;
    }
    try {
      const res = await api.post<{ removed: number }>(`/api/playlists/${selected.id}/remove-damaged`);
      showToast(res.message ?? `${lostCount} dañadas sin datos eliminadas.`);
      await loadAll();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Error al eliminar las dañadas.');
    }
  };

  const exportBackup = async () => {
    try {
      const token = getToken();
      const res = await fetch('/api/playlists/export', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error('No se pudo exportar los datos.');
      const blob = await res.blob();
      const disposition = res.headers.get('content-disposition') ?? '';
      const match = disposition.match(/filename="?([^";]+)"?/);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = match?.[1] ?? 'playlists-backup.json';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      showToast('Backup descargado.');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Error al exportar.');
    }
  };

  const syncStructure = async () => {
    if (!selected) return;
    setSyncingStructure(true);
    try {
      const res = await api.post<{ added: number }>(`/api/playlists/${selected.id}/sync-structure`);
      showToast(res.message ?? 'Estructura sincronizada.');
      await loadAll();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Error al sincronizar la estructura.');
    } finally {
      setSyncingStructure(false);
    }
  };

  const toggleSelectTrack = (id: string) => {
    setSelectedTrackIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const allVisibleSelected =
    pagedTracks.length > 0 && pagedTracks.every((t) => selectedTrackIds.has(t.id));

  const toggleSelectVisible = () => {
    setSelectedTrackIds((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) {
        for (const t of pagedTracks) next.delete(t.id);
      } else {
        for (const t of pagedTracks) next.add(t.id);
      }
      return next;
    });
  };

  const clearSelection = () => setSelectedTrackIds(new Set());

  const applyBulkArtist = async () => {
    if (!selected || selectedTrackIds.size === 0) return;
    const artist = bulkArtist.trim();
    if (!artist) {
      showToast('Escribe el nuevo artista a aplicar.');
      return;
    }
    setBulkSaving(true);
    try {
      const res = await api.post<{ updated: number }>(`/api/playlists/${selected.id}/tracks/bulk`, {
        trackIds: Array.from(selectedTrackIds),
        artist,
      });
      showToast(res.message ?? `${res.data?.updated ?? 0} canciones actualizadas.`);
      setBulkArtist('');
      clearSelection();
      await loadAll();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Error al aplicar el artista.');
    } finally {
      setBulkSaving(false);
    }
  };

  const importBackup = async (file: File) => {
    const text = await file.text();
    if (!window.confirm('¿Restaurar desde este backup? Los datos actuales se reemplazarán (se guarda una copia previa).')) {
      return;
    }
    try {
      const res = await api.post<{ playlists: number; tracks: number }>('/api/playlists/import-backup', { file: text });
      showToast(res.message ?? 'Backup restaurado.');
      setSelectedId(null);
      await loadAll();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Error al restaurar el backup.');
    }
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
        onExport={() => void exportBackup()}
        onImport={(file) => void importBackup(file)}
      />

      <main class="mx-auto max-w-6xl px-4 py-6">
        {playlists.length === 0 ? (
          <div class="rounded-xl border border-dashed border-surface-700 bg-surface-900/50 p-10 text-center text-gray-400">
            <p class="mb-1 text-lg font-medium text-gray-300">Aún no hay playlists</p>
            <p class="mb-4 text-sm">Importa tu primera playlist con el enlace o ID de YouTube.</p>
            <button
              onClick={() => setShowImport(true)}
              class="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-500"
            >
              Importar playlist
            </button>
          </div>
        ) : (
          <>
            <section class="mb-6">
              <div class="mb-3 flex items-center justify-between">
                <h2 class="text-sm font-semibold uppercase tracking-wide text-gray-400">Mis playlists</h2>
                <button
                  onClick={() => setShowImport(true)}
                  class="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-500"
                >
                  Importar playlist
                </button>
              </div>
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
                      onClick={() => void syncStructure()}
                      disabled={syncingStructure}
                      title="Detecta canciones nuevas añadidas directamente en YouTube y las importa sin pisar tus datos"
                      class="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:opacity-60"
                    >
                      {syncingStructure ? 'Sincronizando…' : 'Sincronizar playlist'}
                    </button>
                    <button
                      onClick={() => void syncPlaylist(true)}
                      disabled={syncing}
                      title="Revisa el estado (activa / eliminada / privada / no disponible) de todas las canciones guardadas"
                      class="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:opacity-60"
                    >
                      {syncing ? 'Verificando…' : 'Verificar estados'}
                    </button>
                    <button
                      onClick={verifyDuplicates}
                      title="Revisa las canciones con el mismo título y artista (posibles duplicados reales)"
                      class="rounded-lg border border-blue-600 bg-blue-600/20 px-4 py-2 text-sm font-semibold text-blue-300 transition hover:bg-blue-600/30"
                    >
                      Verificar duplicados
                    </button>
                    {lostCount > 0 && (
                      <button
                        onClick={() => void removeDamaged()}
                        title="Borra solo las dañadas que no tienen datos guardados (no recuperables)"
                        class="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-500"
                      >
                        Eliminar {lostCount} sin datos
                      </button>
                    )}
                  </div>
                </div>

                <SearchAndFilters
                  query={query}
                  onQuery={setQuery}
                  artists={artists}
                  artistFilter={artistFilter}
                  onArtistFilter={setArtistFilter}
                  damagedOnly={damagedOnly}
                  onDamagedOnly={setDamagedOnly}
                  duplicatesOnly={duplicatesOnly}
                  onDuplicatesOnly={setDuplicatesOnly}
                  total={selected.tracks.length}
                  shown={filteredTracks.length}
                />

                {pagedTracks.length > 0 && (
                  <div class="flex flex-wrap items-center gap-3 rounded-xl border border-surface-800 bg-surface-900 p-3">
                    <label class="flex cursor-pointer items-center gap-2 text-sm text-gray-300">
                      <input
                        type="checkbox"
                        checked={allVisibleSelected}
                        onChange={toggleSelectVisible}
                        class="h-4 w-4 cursor-pointer accent-blue-600"
                      />
                      Seleccionar esta página ({pagedTracks.length})
                    </label>
                    <span class="text-xs text-gray-500">
                      {selectedTrackIds.size} seleccionada{selectedTrackIds.size === 1 ? '' : 's'}
                    </span>
                    {selectedTrackIds.size > 0 && (
                      <>
                        <input
                          value={bulkArtist}
                          onInput={(e) => setBulkArtist((e.target as HTMLInputElement).value)}
                          onKeyDown={(e) => e.key === 'Enter' && void applyBulkArtist()}
                          placeholder="Nuevo artista para las seleccionadas…"
                          class="min-w-0 flex-1 rounded-lg border border-surface-700 bg-surface-850 px-3 py-1.5 text-sm text-white placeholder-gray-500 outline-none focus:border-blue-500"
                        />
                        <button
                          onClick={() => void applyBulkArtist()}
                          disabled={bulkSaving || !bulkArtist.trim()}
                          title="Unifica el artista de las canciones seleccionadas (útil para corregir variantes del mismo artista)"
                          class="rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:opacity-60"
                        >
                          {bulkSaving ? 'Aplicando…' : 'Aplicar artista'}
                        </button>
                        <button
                          onClick={clearSelection}
                          class="rounded-lg border border-surface-700 bg-surface-800 px-3 py-1.5 text-sm text-gray-300 transition hover:bg-surface-700"
                        >
                          Limpiar
                        </button>
                      </>
                    )}
                  </div>
                )}

                <TrackList
                  tracks={pagedTracks}
                  selectedIds={selectedTrackIds}
                  duplicateIds={duplicateIds}
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onToggleSort={toggleSort}
                  onToggleSelect={toggleSelectTrack}
                  onRecover={(t) => setRecoveryTrack(t)}
                  onEdit={(t) => setEditingTrack(t)}
                  onDelete={(t) => void deleteTrack(t)}
                />

                <Pagination page={page} totalPages={totalPages} onPage={setPage} />
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

      {editingTrack && selected && (
        <EditTrackModal
          track={editingTrack}
          playlistId={selected.id}
          onClose={() => setEditingTrack(null)}
          onSaved={() => void handleTrackEdited()}
        />
      )}

      {showImport && (
        <ImportModal
          importing={importing}
          onImport={(url) => importPlaylist(url)}
          onClose={() => setShowImport(false)}
        />
      )}
    </div>
  );
}