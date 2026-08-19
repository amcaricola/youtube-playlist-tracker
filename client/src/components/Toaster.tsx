import { useEffect, useState } from 'preact/hooks';
import type { ComponentChildren } from 'preact';

type Listener = (msg: string | null) => void;

let current: Listener | null = null;
let timeoutId: ReturnType<typeof setTimeout> | null = null;

export function subscribeToToast(fn: Listener): () => void {
  current = fn;
  return () => {
    if (current === fn) current = null;
  };
}

export function showToast(msg: string): void {
  if (timeoutId) clearTimeout(timeoutId);
  current?.(msg);
  timeoutId = setTimeout(() => current?.(null), 4000);
}

export default function Toaster(): ComponentChildren {
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => subscribeToToast(setMsg), []);

  if (!msg) return null;
  return (
    <div class="fixed bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-lg bg-gray-800 px-4 py-3 text-sm text-white shadow-xl ring-1 ring-white/10">
      {msg}
    </div>
  );
}