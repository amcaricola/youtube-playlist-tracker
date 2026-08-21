import { useState } from 'preact/hooks';

interface Props {
  importing: boolean;
  onImport: (url: string) => Promise<boolean>;
  onClose: () => void;
}

export default function ImportModal({ importing, onImport, onClose }: Props) {
  const [url, setUrl] = useState('');

  const submit = async () => {
    if (await onImport(url)) onClose();
  };

  return (
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        class="w-full max-w-md rounded-xl border border-surface-700 bg-surface-900 p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div class="mb-4 flex items-center justify-between">
          <h2 class="text-sm font-semibold text-white">Importar playlist</h2>
          <button onClick={onClose} class="text-gray-400 transition hover:text-white" title="Cerrar">
            ✕
          </button>
        </div>

        <input
          value={url}
          onInput={(e) => setUrl((e.target as HTMLInputElement).value)}
          onKeyDown={(e) => e.key === 'Enter' && void submit()}
          placeholder="https://www.youtube.com/playlist?list=…  o  solo el ID"
          autoFocus
          class="w-full rounded-lg border border-surface-700 bg-surface-850 px-4 py-2.5 text-sm text-white placeholder-gray-500 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
        />

        <div class="mt-4 flex justify-end gap-2">
          <button
            onClick={onClose}
            class="rounded-lg border border-surface-700 bg-surface-800 px-4 py-2 text-sm font-medium text-gray-200 transition hover:bg-surface-700"
          >
            Cancelar
          </button>
          <button
            onClick={() => void submit()}
            disabled={importing}
            class="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:opacity-60"
          >
            {importing ? 'Importando…' : 'Importar'}
          </button>
        </div>
      </div>
    </div>
  );
}