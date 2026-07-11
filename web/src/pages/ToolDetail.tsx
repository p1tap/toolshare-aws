import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { api } from "../lib/client";
import { priceFor, type Tool } from "../lib/types";
import { Money, Spinner } from "../components/ui";
import { useAuth } from "../context/auth";
import { useToast } from "../context/toast";

const tomorrow = (days = 1) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};

export default function ToolDetail() {
  const { toolId } = useParams();
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const [tool, setTool] = useState<Tool | null | undefined>(undefined);
  const [startDate, setStartDate] = useState(tomorrow(1));
  const [endDate, setEndDate] = useState(tomorrow(3));
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!toolId) return;
    api
      .getTool(toolId)
      .then(setTool)
      .catch(() => setTool(null));
  }, [toolId]);

  const total = useMemo(
    () => (tool ? priceFor(tool.costPerDay, startDate, endDate) : null),
    [tool, startDate, endDate]
  );

  if (tool === undefined) return <Spinner label="Loading tool…" />;
  if (tool === null)
    return (
      <main className="mx-auto max-w-3xl px-4 py-16 text-center">
        <p className="text-lg font-medium">Tool not found</p>
        <Link to="/" className="mt-2 inline-block text-amber-600 hover:underline">
          Back to browse
        </Link>
      </main>
    );

  const img = api.imageUrl(tool);
  const isOwn = user && tool.ownerId === user.sub;

  async function rent() {
    if (!tool) return;
    setBusy(true);
    try {
      await api.createRental({
        toolId: tool.toolId,
        startDate: new Date(startDate).toISOString(),
        endDate: new Date(endDate).toISOString(),
      });
      toast.push("success", "Rental requested — checkout to confirm it.");
      navigate("/rentals");
    } catch (e) {
      toast.push("error", (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <div className="grid gap-8 md:grid-cols-2">
        <div className="overflow-hidden rounded-2xl border border-stone-200 bg-stone-100 dark:border-stone-800 dark:bg-stone-800">
          {img ? (
            <img src={img} alt={tool.name} className="aspect-[8/5] w-full object-cover" />
          ) : (
            <div className="grid aspect-[8/5] w-full place-items-center text-6xl text-stone-300 dark:text-stone-600">
              🔧
            </div>
          )}
        </div>

        <div>
          <p className="text-xs uppercase tracking-wide text-stone-400">{tool.type}</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">{tool.name}</h1>
          <p className="mt-2 text-xl font-semibold text-amber-600 dark:text-amber-400">
            <Money amount={tool.costPerDay} />
            <span className="text-sm font-normal text-stone-400"> / day</span>
          </p>

          <div className="mt-6 rounded-2xl border border-stone-200 bg-white p-5 shadow-sm dark:border-stone-800 dark:bg-stone-900">
            {isOwn ? (
              <p className="text-sm text-stone-500 dark:text-stone-400">
                This is your tool — manage it from{" "}
                <Link to="/my-tools" className="text-amber-600 hover:underline">
                  My tools
                </Link>
                .
              </p>
            ) : (
              <>
                <div className="flex gap-3">
                  <label className="flex-1 text-sm">
                    <span className="mb-1 block text-stone-500 dark:text-stone-400">From</span>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 dark:border-stone-700 dark:bg-stone-950"
                    />
                  </label>
                  <label className="flex-1 text-sm">
                    <span className="mb-1 block text-stone-500 dark:text-stone-400">Until</span>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 dark:border-stone-700 dark:bg-stone-950"
                    />
                  </label>
                </div>

                <div className="mt-4 flex items-center justify-between text-sm">
                  <span className="text-stone-500 dark:text-stone-400">Total (billed per started day)</span>
                  <span className="text-lg font-bold">
                    {total !== null ? <Money amount={total} /> : "—"}
                  </span>
                </div>

                {user ? (
                  <button
                    onClick={rent}
                    disabled={busy || total === null}
                    className="mt-4 w-full rounded-xl bg-amber-500 py-2.5 font-semibold text-white shadow-sm transition-colors hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {busy ? "Requesting…" : "Request rental"}
                  </button>
                ) : (
                  <Link
                    to="/login"
                    className="mt-4 block w-full rounded-xl bg-amber-500 py-2.5 text-center font-semibold text-white shadow-sm hover:bg-amber-600"
                  >
                    Log in to rent
                  </Link>
                )}
                {total === null && (
                  <p className="mt-2 text-xs text-rose-500">End date must be after the start date.</p>
                )}
              </>
            )}
          </div>

          <p className="mt-4 text-xs text-stone-400">
            Listed {new Date(tool.createdAt).toLocaleDateString()} · owner {tool.ownerId.slice(0, 8)}…
          </p>
        </div>
      </div>
    </main>
  );
}
