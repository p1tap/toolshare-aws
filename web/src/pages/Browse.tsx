import { useEffect, useMemo, useState } from "react";
import { api } from "../lib/client";
import type { Tool } from "../lib/types";
import { EmptyState, Spinner, ToolCard } from "../components/ui";
import { useToast } from "../context/toast";

const PAGE = 24; // render in pages so a large catalog stays snappy

export default function Browse() {
  const [tools, setTools] = useState<Tool[] | null>(null);
  const [query, setQuery] = useState("");
  const [type, setType] = useState("all");
  const [limit, setLimit] = useState(PAGE);
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

  const visible = useMemo(
    () =>
      (tools ?? []).filter(
        (t) =>
          (type === "all" || t.type === type) &&
          t.name.toLowerCase().includes(query.trim().toLowerCase())
      ),
    [tools, query, type]
  );

  // reset paging whenever the search or category filter changes
  useEffect(() => setLimit(PAGE), [query, type]);

  const shown = visible.slice(0, limit);

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

      {/* category menu — click to filter, search stays independent */}
      <nav className="mb-6 flex flex-wrap gap-2">
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
          {visible.length > limit && (
            <div className="mt-8 flex justify-center">
              <button
                onClick={() => setLimit((l) => l + PAGE)}
                className="rounded-lg border border-stone-300 bg-white px-5 py-2.5 text-sm font-medium hover:bg-stone-50 dark:border-stone-700 dark:bg-stone-900 dark:hover:bg-stone-800"
              >
                Load more ({visible.length - limit} more)
              </button>
            </div>
          )}
          <p className="mt-4 text-center text-xs text-stone-400">
            Showing {shown.length} of {visible.length}
          </p>
        </>
      )}
    </main>
  );
}
