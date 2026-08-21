import { useState } from 'preact/hooks';
import SessionManager from './SessionManager';
import UserMenu from './UserMenu';
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
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <>
      <header class="border-b border-surface-800 bg-surface-900/80 backdrop-blur">
        <div class="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div class="flex items-center gap-3">
            <div class="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600/20 text-lg">🎵</div>
            <div>
              <h1 class="text-sm font-semibold text-white">YouTube Playlist Tracker</h1>
              <p class="text-[11px] text-gray-500">Monitoreo y recuperación de canciones</p>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <SessionManager
              oauth={oauth}
              onOpenOAuth={onOpenOAuth}
              onDisconnectOAuth={onDisconnectOAuth}
              onLogout={onLogout}
            />
            <button
              onClick={() => setMenuOpen(true)}
              title="Menú de usuario: sesiones, backup, bloqueo"
              class="flex h-9 w-9 items-center justify-center rounded-lg border border-surface-700 bg-surface-800 text-gray-200 transition hover:bg-surface-700"
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
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      {menuOpen && (
        <UserMenu
          oauth={oauth}
          session={session}
          onClose={() => setMenuOpen(false)}
          onExport={onExport}
          onImport={onImport}
          onLogout={onLogout}
        />
      )}
    </>
  );
}