import { useState } from "react";
import { useNavigate } from "react-router";
import { api } from "../lib/client";
import { useToast } from "../context/toast";

const TYPES = ["general", "power", "garden", "construction", "cleaning", "automotive", "access"];

export default function NewTool() {
  const [name, setName] = useState("");
  const [type, setType] = useState("general");
  const [costPerDay, setCostPerDay] = useState("");
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const navigate = useNavigate();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const cost = Number(costPerDay);
    if (!name.trim() || !Number.isFinite(cost) || cost <= 0) {
      toast.push("error", "Give it a name and a positive daily price.");
      return;
    }
    setBusy(true);
    try {
      await api.createTool({ name: name.trim(), type, costPerDay: cost });
      toast.push("success", "Listed! Add a photo so it stands out.");
      navigate("/my-tools");
    } catch (err) {
      toast.push("error", (err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const input =
    "w-full rounded-lg border border-stone-300 bg-white px-3 py-2 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200 dark:border-stone-700 dark:bg-stone-950";

  return (
    <main className="mx-auto max-w-lg px-4 py-10">
      <h1 className="text-2xl font-bold tracking-tight">List a tool</h1>
      <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
        You stay the owner — renters pay per started day.
      </p>

      <form onSubmit={submit} className="mt-6 space-y-5 rounded-2xl border border-stone-200 bg-white p-6 shadow-sm dark:border-stone-800 dark:bg-stone-900">
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Cordless Drill 18V" className={input} />
        </label>

        <label className="block text-sm">
          <span className="mb-1 block font-medium">Category</span>
          <select value={type} onChange={(e) => setType(e.target.value)} className={`${input} capitalize`}>
            {TYPES.map((t) => (
              <option key={t} value={t} className="capitalize">
                {t}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-sm">
          <span className="mb-1 block font-medium">Price per day (฿)</span>
          <input
            value={costPerDay}
            onChange={(e) => setCostPerDay(e.target.value)}
            inputMode="numeric"
            placeholder="120"
            className={input}
          />
        </label>

        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-xl bg-amber-500 py-2.5 font-semibold text-white shadow-sm hover:bg-amber-600 disabled:opacity-50"
        >
          {busy ? "Listing…" : "List it"}
        </button>
      </form>
    </main>
  );
}
