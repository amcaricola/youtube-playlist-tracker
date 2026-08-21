function pageList(current: number, total: number): (number | '…')[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  const pages: (number | '…')[] = [1];
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  if (start > 2) pages.push('…');
  for (let i = start; i <= end; i++) pages.push(i);
  if (end < total - 1) pages.push('…');
  pages.push(total);
  return pages;
}

interface Props {
  page: number;
  totalPages: number;
  onPage: (p: number) => void;
}

export default function Pagination({ page, totalPages, onPage }: Props) {
  if (totalPages <= 1) return null;

  const cls =
    'min-w-[2rem] rounded-lg border border-surface-700 bg-surface-900 px-2 py-1.5 text-sm text-gray-300 transition hover:bg-surface-800 disabled:cursor-not-allowed disabled:opacity-40';

  return (
    <nav class="flex flex-wrap items-center justify-center gap-1.5 pt-4">
      <button class={cls} disabled={page === 1} onClick={() => onPage(page - 1)}>
        ‹
      </button>
      {pageList(page, totalPages).map((p, i) =>
        p === '…' ? (
          <span key={`e${i}`} class="px-1 text-sm text-gray-500">
            …
          </span>
        ) : (
          <button
            key={p}
            onClick={() => onPage(p)}
            class={`min-w-[2rem] rounded-lg px-2 py-1.5 text-sm transition ${
              p === page
                ? 'bg-blue-600 font-semibold text-white'
                : 'border border-surface-700 bg-surface-900 text-gray-300 hover:bg-surface-800'
            }`}
          >
            {p}
          </button>
        ),
      )}
      <button class={cls} disabled={page === totalPages} onClick={() => onPage(page + 1)}>
        ›
      </button>
    </nav>
  );
}