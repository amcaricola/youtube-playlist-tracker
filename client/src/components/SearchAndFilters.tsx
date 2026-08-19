interface Props {
  query: string;
  onQuery: (q: string) => void;
  artists: string[];
  artistFilter: string;
  onArtistFilter: (a: string) => void;
  total: number;
  shown: number;
}

export default function SearchAndFilters({
  query,
  onQuery,
  artists,
  artistFilter,
  onArtistFilter,
  total,
  shown,
}: Props) {
  return (
    <div class="flex flex-col gap-2 sm:flex-row sm:items-center">
      <div class="relative flex-1">
        <span class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">🔍</span>
        <input
          value={query}
          onInput={(e) => onQuery((e.target as HTMLInputElement).value)}
          placeholder="Buscar por canción o artista…"
          class="w-full rounded-lg border border-surface-700 bg-surface-900 py-2 pl-9 pr-3 text-sm text-white placeholder-gray-500 outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500"
        />
      </div>

      <select
        value={artistFilter}
        onInput={(e) => onArtistFilter((e.target as HTMLSelectElement).value)}
        class="rounded-lg border border-surface-700 bg-surface-900 px-3 py-2 text-sm text-gray-200 outline-none focus:border-red-500"
      >
        <option value="">Todos los artistas</option>
        {artists.map((a) => (
          <option key={a} value={a}>
            {a}
          </option>
        ))}
      </select>

      <span class="whitespace-nowrap text-xs text-gray-500">
        Mostrando {shown} de {total}
      </span>
    </div>
  );
}