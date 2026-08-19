import { useState } from 'preact/hooks';
import { api, clearAuth } from '../services/api';
import { showToast } from './Toaster';
import type { OAuthStatus, SessionSummary } from '../types';

interface Props {
  oauth: OAuthStatus | null;
  session: SessionSummary | null;
  onOpenOAuth: () => void;
  onDisconnectOAuth: () => void;
  onLogout: () => void;
}

export default function SessionManager({ oauth, session, onOpenOAuth, onDisconnectOAuth, onLogout }: Props) {
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
    <div class="flex flex-wrap items-center gap-2">
      {oauth?.connected ? (
        <span class="inline-flex items-center gap-2 rounded-lg border border-emerald-900/60 bg-emerald-950/40 px-3 py-1.5 text-xs text-emerald-300">
          <span class="h-2 w-2 rounded-full bg-emerald-400" />
          YouTube: {oauth.channelTitle ?? 'conectado'}
          <button
            onClick={() => {
              if (
                window.confirm(
                  '¿Desconectar YouTube? El acceso (token) se revocará también en Google. Los datos guardados en la app se conservan.',
                )
              ) {
                onDisconnectOAuth();
              }
            }}
            class="ml-1 text-emerald-400 underline-offset-2 hover:underline"
          >
            desconectar
          </button>
        </span>
      ) : (
        <button
          onClick={onOpenOAuth}
          class="rounded-lg border border-surface-700 bg-surface-800 px-3 py-1.5 text-xs font-medium text-gray-200 transition hover:bg-surface-700"
        >
          Conectar YouTube (OAuth)
        </button>
      )}

      <span class="hidden text-xs text-gray-500 sm:inline">
        {session ? `${session.count} sesión(es) activa(s)` : ''}
      </span>

      <button
        onClick={() => void blockAll()}
        disabled={blocking}
        class="rounded-lg border border-red-900/50 bg-red-950/40 px-3 py-1.5 text-xs font-medium text-red-300 transition hover:bg-red-950/70 disabled:opacity-60"
      >
        {blocking ? 'Revocando…' : 'Block All Sessions'}
      </button>

      <button
        onClick={onLogout}
        class="rounded-lg border border-surface-700 bg-surface-800 px-3 py-1.5 text-xs font-medium text-gray-200 transition hover:bg-surface-700"
      >
        Cerrar sesión
      </button>
    </div>
  );
}