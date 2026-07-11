import { useEffect, useMemo, useState } from "react";
import { api } from "../lib/client";
import type { Tool } from "../lib/types";
import { EmptyState, Spinner, ToolCard } from "../components/ui";
import { useToast } from "../context/toast";

export default function Browse() {
  const [tools, setTools] = useState<Tool[] | null>(null);
  const [query, setQuery] = useState("");
  const [type, setType] = useState("all");
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

  const types = useMemo(
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

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Rent a tool near you</h1>
          <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
            Borrow what you need, list what you don't use.
          </p>
        </div>
        <div className="flex gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search tools…"
            className="w-48 rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200 dark:border-stone-700 dark:bg-stone-900"
          />
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm capitalize dark:border-stone-700 dark:bg-stone-900"
          >
            {types.map((t) => (
              <option key={t} value={t} className="capitalize">
                {t}
              </option>
            ))}
          </select>
        </div>
      </div>

      {tools === null ? (
        <Spinner label="Loading tools…" />
      ) : visible.length === 0 ? (
        <EmptyState title="No tools match" hint="Try a different search or type filter." />
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((t) => (
            <ToolCard key={t.toolId} tool={t} />
          ))}
        </div>
      )}
    </main>
  );
}
