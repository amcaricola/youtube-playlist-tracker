import { useState } from 'preact/hooks';
import { api, clearAuth } from '../services/api';
import { showToast } from './Toaster';
import type { OAuthStatus, SessionSummary } from '../types';

interface Props {
  oauth: OAuthStatus | null;
  session: SessionSummary | null;
  onClose: () => void;
  onExport: () => void;
  onImport: (file: File) => void;
  onLogout: () => void;
}

export default function UserMenu({ oauth, session, onClose, onExport, onImport, onLogout }: Props) {
  const [blocking, setBlocking] = useState(false);

  const blockAll = async () => {
    if (!window.confirm('¿Revocar TODAS las sesiones activas? Deberás volver a ingresar la contraseña.')) return;
    setBlocking(true);
    try {
      const res = await api.post<{ message: string }>('/api/auth/block-all');
      showToast(res.message ?? 'Sesiones revocadas.');
      clearAuth();
      onLogout();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Error al revocar sesiones.');
    } finally {
      setBlocking(false);
    }
  };

  return (
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        class="w-full max-w-sm rounded-xl border border-surface-700 bg-surface-900 p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div class="mb-4 flex items-center justify-between">
          <h2 class="text-sm font-semibold text-white">Menú de usuario</h2>
          <button onClick={onClose} class="text-gray-400 transition hover:text-white" title="Cerrar">
            ✕
          </button>
        </div>

        {oauth?.connected ? (
          <p class="mb-1 text-xs text-gray-400">
            YouTube: <span class="text-emerald-300">{oauth.channelTitle ?? 'conectado'}</span>
          </p>
        ) : (
          <p class="mb-1 text-xs text-gray-500">YouTube no conectado</p>
        )}
        <p class="mb-4 text-xs text-gray-500">{session ? `${session.count} sesión(es) activa(s)` : ''}</p>

        <div class="space-y-2">
          <button
            onClick={() => void blockAll()}
            disabled={blocking}
            title="Revoca todas las sesiones activas"
            class="w-full rounded-lg border border-red-900/50 bg-red-950/40 px-3 py-2 text-sm font-medium text-red-300 transition hover:bg-red-950/70 disabled:opacity-60"
          >
            {blocking ? 'Revocando…' : 'Block All Sessions'}
          </button>

          <button
            onClick={() => {
              onExport();
              onClose();
            }}
            title="Descargar el JSON completo con todos los metadatos"
            class="flex w-full items-center justify-center gap-2 rounded-lg border border-surface-700 bg-surface-800 px-3 py-2 text-sm font-medium text-gray-200 transition hover:bg-surface-700"
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
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Descargar backup
          </button>

          <label class="flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg border border-surface-700 bg-surface-800 px-3 py-2 text-sm font-medium text-gray-200 transition hover:bg-surface-700">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              class="h-4 w-4"
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            Restaurar backup
            <input
              type="file"
              accept="application/json,.json"
              class="hidden"
              onChange={(e) => {
                const file = (e.target as HTMLInputElement).files?.[0];
                if (file) {
                  onImport(file);
                  onClose();
                }
                (e.target as HTMLInputElement).value = '';
              }}
            />
          </label>
        </div>
      </div>
    </div>
  );
}