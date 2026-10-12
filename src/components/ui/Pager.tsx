"use client";

/** Prev / page numbers / Next row — same markup the server-paged lists
 * (CA sessions, doctor appointments, reception tables) each inline.
 * Renders nothing for a single page. */
export function Pager({ page, totalPages, total, noun = "records", onPage }: {
  page: number; totalPages: number; total: number; noun?: string; onPage: (page: number) => void;
}) {
  if (totalPages <= 1) return null;
  const btn = "px-3 py-1 rounded-lg text-xs font-medium text-neutral-500 hover:bg-neutral-100 disabled:opacity-40 disabled:hover:bg-transparent transition-colors";
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
      <p className="text-xs text-neutral-500">
        Showing page {Math.min(page, totalPages)} of {totalPages} · {total} {noun}
      </p>
      <div className="flex items-center gap-1.5 flex-wrap">
        <button onClick={() => onPage(Math.max(1, page - 1))} disabled={page <= 1} className={btn}>Prev</button>
        {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
          <button
            key={n}
            onClick={() => onPage(n)}
            className={`w-7 h-7 rounded-lg text-xs font-medium transition-colors ${
              n === page ? "bg-brand-gradient text-white" : "text-neutral-600 hover:bg-neutral-100"
            }`}
          >
            {n}
          </button>
        ))}
        <button onClick={() => onPage(Math.min(totalPages, page + 1))} disabled={page >= totalPages} className={btn}>Next</button>
      </div>
    </div>
  );
}
