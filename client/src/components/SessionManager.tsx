import type { OAuthStatus } from '../types';

interface Props {
  oauth: OAuthStatus | null;
  onOpenOAuth: () => void;
  onDisconnectOAuth: () => void;
  onLogout: () => void;
}

export default function SessionManager({ oauth, onOpenOAuth, onDisconnectOAuth, onLogout }: Props) {
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

      <button
        onClick={onLogout}
        class="rounded-lg border border-surface-700 bg-surface-800 px-3 py-1.5 text-xs font-medium text-gray-200 transition hover:bg-surface-700"
      >
        Cerrar sesión
      </button>
    </div>
  );
}