import { useState } from 'preact/hooks';
import { api, saveAuth } from '../services/api';
import type { AuthData } from '../types';

interface Props {
  onLogin: () => void;
}

export default function Login({ onLogin }: Props) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e: Event) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await api.post<AuthData>('/api/auth/login', { password });
      if (res.data) saveAuth(res.data);
      onLogin();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo iniciar sesión.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div class="flex min-h-screen items-center justify-center bg-surface-950 px-4">
      <div class="w-full max-w-sm">
        <div class="mb-8 text-center">
          <div class="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600/20 text-2xl">
            🎵
          </div>
          <h1 class="text-2xl font-semibold text-white">YouTube Playlist Tracker</h1>
          <p class="mt-1 text-sm text-gray-400">Acceso restringido al Super Usuario</p>
        </div>

        <form onSubmit={submit} class="space-y-4">
          <div>
            <label for="password" class="mb-1 block text-sm font-medium text-gray-300">
              Contraseña maestra
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onInput={(e) => setPassword((e.target as HTMLInputElement).value)}
              placeholder="••••••••"
              autocomplete="current-password"
              required
              class="w-full rounded-lg border border-surface-700 bg-surface-900 px-4 py-2.5 text-sm text-white placeholder-gray-500 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {error && (
            <div class="rounded-lg border border-red-900/50 bg-red-950/40 px-3 py-2 text-sm text-red-300">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            class="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? 'Entrando…' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  );
}