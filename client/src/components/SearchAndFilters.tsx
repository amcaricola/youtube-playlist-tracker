import { useEffect, useMemo, useState } from 'preact/hooks';

interface Props {
  query: string;
  onQuery: (q: string) => void;
  artists: string[];
  artistFilter: string;
  onArtistFilter: (a: string) => void;
  damagedOnly: boolean;
  onDamagedOnly: (v: boolean) => void;
  duplicatesOnly: boolean;
  onDuplicatesOnly: (v: boolean) => void;
  total: number;
  shown: number;
}

function ArtistAutocomplete({
  artists,
  value,
  onChange,
}: {
  artists: string[];
  value: string;
  onChange: (a: string) => void;
}) {
  const [input, setInput] = useState(value);
  const [open, setOpen] = useState(false);

  useEffect(() => setInput(value), [value]);

  const matches = useMemo(() => {
    const q = input.trim().toLowerCase();
    if (!q) return [];
    return artists.filter((a) => a.toLowerCase().includes(q)).slice(0, 3);
  }, [input, artists]);

  const pick = (a: string) => {
    onChange(a);
    setInput(a);
    setOpen(false);
  };

  return (
    <div class="relative w-full sm:w-64">
      <input
        value={input}
        onInput={(e) => {
          setInput((e.target as HTMLInputElement).value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder="Filtrar por artista…"
        class="w-full rounded-lg border border-surface-700 bg-surface-900 py-2 pl-3 pr-8 text-sm text-white placeholder-gray-500 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
      />
      {value && (
        <button
          onClick={() => {
            onChange('');
            setInput('');
          }}
          title="Limpiar filtro de artista"
          class="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-gray-500 transition hover:bg-surface-700 hover:text-white"
        >
          ✕
        </button>
      )}

      {open && matches.length > 0 && (
        <ul class="absolute left-0 right-0 top-full z-30 mt-1 overflow-hidden rounded-lg border border-surface-700 bg-surface-850 shadow-xl">
          {matches.map((a) => (
            <li key={a}>
              <button
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(a)}
                class="block w-full truncate px-3 py-2 text-left text-sm text-gray-200 transition hover:bg-surface-700"
              >
                {a}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function SearchAndFilters({
  query,
  onQuery,
  artists,
  artistFilter,
  onArtistFilter,
  damagedOnly,
  onDamagedOnly,
  duplicatesOnly,
  onDuplicatesOnly,
  total,
  shown,
}: Props) {
  return (
    <div class="flex flex-col gap-2">
      <div class="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div class="relative flex-1">
          <span class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">🔍</span>
          <input
            value={query}
            onInput={(e) => onQuery((e.target as HTMLInputElement).value)}
            placeholder="Buscar por canción o artista…"
            class="w-full rounded-lg border border-surface-700 bg-surface-900 py-2 pl-9 pr-8 text-sm text-white placeholder-gray-500 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          />
          {query && (
            <button
              onClick={() => onQuery('')}
              title="Limpiar búsqueda"
              class="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-gray-500 transition hover:bg-surface-700 hover:text-white"
            >
              ✕
            </button>
          )}
        </div>

        <ArtistAutocomplete artists={artists} value={artistFilter} onChange={onArtistFilter} />

        <button
          onClick={() => onDamagedOnly(!damagedOnly)}
          class={`shrink-0 rounded-lg border px-3 py-2 text-sm font-medium transition ${
            damagedOnly
              ? 'border-blue-500 bg-blue-500/20 text-blue-300'
              : 'border-surface-700 bg-surface-900 text-gray-300 hover:bg-surface-850'
          }`}
        >
          {damagedOnly ? '✓ ' : ''}Solo dañadas
        </button>

        <button
          onClick={() => onDuplicatesOnly(!duplicatesOnly)}
          class={`shrink-0 rounded-lg border px-3 py-2 text-sm font-medium transition ${
            duplicatesOnly
              ? 'border-orange-500 bg-orange-500/20 text-orange-300'
              : 'border-surface-700 bg-surface-900 text-gray-300 hover:bg-surface-850'
          }`}
        >
          {duplicatesOnly ? '✓ ' : ''}Solo duplicadas
        </button>
      </div>

      <div class="text-xs text-gray-500">
        Mostrando {shown} de {total}
      </div>
    </div>
  );
}