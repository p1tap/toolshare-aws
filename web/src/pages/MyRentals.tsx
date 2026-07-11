// The saga demo page: checkout drives the synchronous Step Functions saga.
// A 402 means the payment step failed and the reservation was COMPENSATED
// back to "requested" — surfaced as a retryable banner, not a dead end.

import { useEffect, useState } from "react";
import { Link } from "react-router";
import { api } from "../lib/client";
import { ApiError, type Rental, type Tool } from "../lib/types";
import { EmptyState, Money, Spinner, StatusBadge } from "../components/ui";
import { useToast } from "../context/toast";

export default function MyRentals() {
  const [rentals, setRentals] = useState<Rental[] | null>(null);
  const [toolNames, setToolNames] = useState<Record<string, Tool>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [failedId, setFailedId] = useState<string | null>(null);
  const toast = useToast();

  async function load() {
    const [rs, ts] = await Promise.all([api.listMyRentals(), api.listTools()]);
    setRentals(rs);
    setToolNames(Object.fromEntries(ts.map((t) => [t.toolId, t])));
  }

  useEffect(() => {
    load().catch((e) => {
      setRentals([]);
      toast.push("error", e.message);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function checkout(rentalId: string) {
    setBusyId(rentalId);
    setFailedId(null);
    try {
      await api.checkout(rentalId);
      toast.push("success", "Payment confirmed — rental is active.");
    } catch (e) {
      if (e instanceof ApiError && e.status === 402) {
        setFailedId(rentalId);
      } else {
        toast.push("error", (e as Error).message);
      }
    } finally {
      setBusyId(null);
      load().catch(() => {});
    }
  }

  async function returnRental(rentalId: string) {
    setBusyId(rentalId);
    try {
      await api.returnRental(rentalId);
      toast.push("success", "Returned — thanks for bringing it back.");
    } catch (e) {
      toast.push("error", (e as Error).message);
    } finally {
      setBusyId(null);
      load().catch(() => {});
    }
  }

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold tracking-tight">My rentals</h1>

      {rentals === null ? (
        <Spinner label="Loading rentals…" />
      ) : rentals.length === 0 ? (
        <EmptyState
          title="No rentals yet"
          hint="Find something useful and request it."
          action={
            <Link to="/" className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-600">
              Browse tools
            </Link>
          }
        />
      ) : (
        <ul className="space-y-4">
          {rentals.map((r) => {
            const tool = toolNames[r.toolId];
            const days = Math.round(
              (new Date(r.endDate).getTime() - new Date(r.startDate).getTime()) / 86_400_000
            );
            return (
              <li
                key={r.rentalId}
                className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm dark:border-stone-800 dark:bg-stone-900"
              >
                <div className="flex flex-wrap items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <Link to={`/tools/${r.toolId}`} className="font-semibold hover:underline">
                      {tool?.name ?? r.toolId}
                    </Link>
                    <p className="mt-0.5 text-sm text-stone-500 dark:text-stone-400">
                      {new Date(r.startDate).toLocaleDateString()} →{" "}
                      {new Date(r.endDate).toLocaleDateString()} · {days} day{days === 1 ? "" : "s"} ·{" "}
                      <Money amount={r.totalPrice} />
                    </p>
                  </div>
                  <StatusBadge status={r.status} />
                  {r.status === "requested" && (
                    <button
                      onClick={() => checkout(r.rentalId)}
                      disabled={busyId === r.rentalId}
                      className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-600 disabled:opacity-50"
                    >
                      {busyId === r.rentalId ? "Charging…" : "Checkout"}
                    </button>
                  )}
                  {r.status === "active" && (
                    <button
                      onClick={() => returnRental(r.rentalId)}
                      disabled={busyId === r.rentalId}
                      className="rounded-lg border border-stone-300 px-4 py-2 text-sm font-semibold hover:bg-stone-100 disabled:opacity-50 dark:border-stone-700 dark:hover:bg-stone-800"
                    >
                      {busyId === r.rentalId ? "Returning…" : "Return"}
                    </button>
                  )}
                </div>

                {failedId === r.rentalId && (
                  <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
                    <span className="font-semibold">Payment failed.</span>
                    <span className="min-w-0 flex-1">
                      Your reservation was automatically released — nothing is held, nothing was
                      charged. Try again when ready.
                    </span>
                    <button
                      onClick={() => checkout(r.rentalId)}
                      className="rounded-lg bg-rose-600 px-3 py-1.5 font-semibold text-white hover:bg-rose-700"
                    >
                      Retry payment
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
