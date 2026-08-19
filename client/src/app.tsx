import { useEffect, useState } from 'preact/hooks';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Toaster from './components/Toaster';
import Footer from './components/Footer';
import { api, clearAuth, getToken, isTokenExpired } from './services/api';
import type { SessionSummary } from './types';

export default function App() {
  const [authed, setAuthed] = useState<boolean | null>(null);

  useEffect(() => {
    const check = async () => {
      if (!getToken() || isTokenExpired()) {
        clearAuth();
        setAuthed(false);
        return;
      }
      try {
        await api.get<SessionSummary>('/api/auth/session');
        setAuthed(true);
      } catch {
        setAuthed(false);
      }
    };
    void check();
  }, []);

  if (authed === null) {
    return (
      <div class="flex min-h-screen items-center justify-center bg-surface-950 text-sm text-gray-400">
        Verificando sesión…
      </div>
    );
  }

  return (
    <>
      <Toaster />
      {authed ? <Dashboard onLogout={() => setAuthed(false)} /> : <Login onLogin={() => setAuthed(true)} />}
      <Footer />
    </>
  );
}