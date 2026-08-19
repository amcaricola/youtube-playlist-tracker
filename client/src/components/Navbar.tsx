import SessionManager from './SessionManager';
import type { OAuthStatus, SessionSummary } from '../types';

interface Props {
  oauth: OAuthStatus | null;
  session: SessionSummary | null;
  onOpenOAuth: () => void;
  onDisconnectOAuth: () => void;
  onLogout: () => void;
  onExport: () => void;
  onImport: (file: File) => void;
}

export default function Navbar({ oauth, session, onOpenOAuth, onDisconnectOAuth, onLogout, onExport, onImport }: Props) {
  return (
    <header class="sticky top-0 z-40 border-b border-surface-800 bg-surface-900/80 backdrop-blur">
      <div class="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
        <div class="flex items-center gap-3">
          <div class="flex h-9 w-9 items-center justify-center rounded-lg bg-red-600/20 text-lg">🎵</div>
          <div>
            <h1 class="text-sm font-semibold text-white">YouTube Playlist Tracker</h1>
            <p class="text-[11px] text-gray-500">Monitoreo y recuperación de canciones</p>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <label class="cursor-pointer rounded-lg border border-surface-700 bg-surface-800 px-3 py-1.5 text-xs font-medium text-gray-200 transition hover:bg-surface-700">
            ⬆ Restaurar
            <input
              type="file"
              accept="application/json,.json"
              class="hidden"
              onChange={(e) => {
                const file = (e.target as HTMLInputElement).files?.[0];
                if (file) {
                  onImport(file);
                  (e.target as HTMLInputElement).value = '';
                }
              }}
            />
          </label>
          <button
            onClick={onExport}
            title="Descargar backup de todos los datos (JSON)"
            class="rounded-lg border border-surface-700 bg-surface-800 px-3 py-1.5 text-xs font-medium text-gray-200 transition hover:bg-surface-700"
          >
            ⬇ Backup
          </button>
          <SessionManager
            oauth={oauth}
            session={session}
            onOpenOAuth={onOpenOAuth}
            onDisconnectOAuth={onDisconnectOAuth}
            onLogout={onLogout}
          />
        </div>
      </div>
    </header>
  );
}