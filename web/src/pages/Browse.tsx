import { useEffect, useMemo, useState } from "react";
import { api } from "../lib/client";
import type { Tool } from "../lib/types";
import { EmptyState, Spinner, ToolCard, recommendedTag } from "../components/ui";
import { useToast } from "../context/toast";

const PAGE = 100; // tools per page

type Sort = "recommended" | "recent" | "price-asc" | "price-desc";
const SORTS: { key: Sort; label: string }[] = [
  { key: "recommended", label: "Recommended" },
  { key: "recent", label: "Newest" },
  { key: "price-asc", label: "Price ↑" },
  { key: "price-desc", label: "Price ↓" },
];

export default function Browse() {
  const [tools, setTools] = useState<Tool[] | null>(null);
  const [query, setQuery] = useState("");
  const [type, setType] = useState("all");
  const [sort, setSort] = useState<Sort>("recommended");
  const [page, setPage] = useState(1);
  const toast = useToast();

  useEffect(() => {
    api
      .listTools()
      .then(setTools)
      .catch((e) => {
        setTools([]);
        toast.push("error", e.message);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const categories = useMemo(
    () => ["all", ...Array.from(new Set((tools ?? []).map((t) => t.type))).sort()],
    [tools]
  );

  const visible = useMemo(() => {
    const arr = (tools ?? []).filter(
      (t) =>
        (type === "all" || t.type === type) &&
        t.name.toLowerCase().includes(query.trim().toLowerCase())
    );
    const byRecent = (a: Tool, b: Tool) => b.createdAt.localeCompare(a.createdAt);
    if (sort === "price-asc") arr.sort((a, b) => a.costPerDay - b.costPerDay || byRecent(a, b));
    else if (sort === "price-desc") arr.sort((a, b) => b.costPerDay - a.costPerDay || byRecent(a, b));
    else if (sort === "recent") arr.sort(byRecent);
    else
      arr.sort((a, b) => {
        const ra = recommendedTag(a.toolId) ? 0 : 1;
        const rb = recommendedTag(b.toolId) ? 0 : 1;
        return ra - rb || byRecent(a, b);
      });
    return arr;
  }, [tools, query, type, sort]);

  // reset to page 1 whenever the result set changes
  useEffect(() => setPage(1), [query, type, sort]);

  const totalPages = Math.max(1, Math.ceil(visible.length / PAGE));
  const shown = visible.slice((page - 1) * PAGE, page * PAGE);
  const go = (p: number) => {
    setPage(Math.min(totalPages, Math.max(1, p)));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const pageBtn =
    "min-w-9 rounded-md px-3 py-1.5 text-sm font-medium transition-colors";

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Rent a tool near you</h1>
          <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
            Borrow what you need, list what you don't use.
          </p>
        </div>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search tools…"
          className="w-56 rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200 dark:border-stone-700 dark:bg-stone-900"
        />
      </div>

      {/* category menu */}
      <nav className="mb-4 flex flex-wrap gap-2">
        {categories.map((c) => (
          <button
            key={c}
            onClick={() => setType(c)}
            aria-pressed={type === c}
            className={
              "rounded-full px-3.5 py-1.5 text-sm font-medium capitalize transition-colors " +
              (type === c
                ? "bg-amber-500 text-white shadow-sm"
                : "bg-stone-100 text-stone-600 hover:bg-stone-200 dark:bg-stone-800 dark:text-stone-300 dark:hover:bg-stone-700")
            }
          >
            {c}
          </button>
        ))}
      </nav>

      {/* sort */}
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <span className="text-sm text-stone-500 dark:text-stone-400">Sort:</span>
        {SORTS.map((s) => (
          <button
            key={s.key}
            onClick={() => setSort(s.key)}
            aria-pressed={sort === s.key}
            className={
              "rounded-md px-3 py-1 text-sm font-medium transition-colors " +
              (sort === s.key
                ? "bg-stone-800 text-white dark:bg-white dark:text-stone-900"
                : "text-stone-600 hover:bg-stone-200 dark:text-stone-300 dark:hover:bg-stone-800")
            }
          >
            {s.label}
          </button>
        ))}
      </div>

      {tools === null ? (
        <Spinner label="Loading tools…" />
      ) : visible.length === 0 ? (
        <EmptyState title="No tools match" hint="Try a different search or category." />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {shown.map((t) => (
              <ToolCard key={t.toolId} tool={t} />
            ))}
          </div>

          {totalPages > 1 && (
            <nav className="mt-8 flex flex-wrap items-center justify-center gap-1">
              <button
                disabled={page === 1}
                onClick={() => go(page - 1)}
                className={`${pageBtn} enabled:hover:bg-stone-200 disabled:opacity-40 dark:enabled:hover:bg-stone-800`}
              >
                ← Prev
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                <button
                  key={p}
                  onClick={() => go(p)}
                  aria-current={p === page}
                  className={
                    pageBtn +
                    " " +
                    (p === page
                      ? "bg-amber-500 text-white"
                      : "text-stone-600 hover:bg-stone-200 dark:text-stone-300 dark:hover:bg-stone-800")
                  }
                >
                  {p}
                </button>
              ))}
              <button
                disabled={page === totalPages}
                onClick={() => go(page + 1)}
                className={`${pageBtn} enabled:hover:bg-stone-200 disabled:opacity-40 dark:enabled:hover:bg-stone-800`}
              >
                Next →
              </button>
            </nav>
          )}

          <p className="mt-4 text-center text-xs text-stone-400">
            Showing {shown.length} of {visible.length} · page {page} of {totalPages}
          </p>
        </>
      )}
    </main>
  );
}
