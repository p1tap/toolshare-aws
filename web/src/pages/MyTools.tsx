import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { api } from "../lib/client";
import type { Tool } from "../lib/types";
import { EmptyState, Spinner, ToolCard } from "../components/ui";
import { useToast } from "../context/toast";

export default function MyTools() {
  const [tools, setTools] = useState<Tool[] | null>(null);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const pendingToolId = useRef<string | null>(null);
  const toast = useToast();

  function load() {
    api
      .listMyTools()
      .then(setTools)
      .catch((e) => {
        setTools([]);
        toast.push("error", e.message);
      });
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(load, []);

  function pickPhoto(toolId: string) {
    pendingToolId.current = toolId;
    fileInput.current?.click();
  }

  async function onFile(files: FileList | null) {
    const toolId = pendingToolId.current;
    const file = files?.[0];
    if (!toolId || !file) return;
    setUploadingId(toolId);
    try {
      await api.uploadToolImage(toolId, file);
      toast.push("success", "Photo uploaded.");
      load();
    } catch (e) {
      toast.push("error", (e as Error).message);
    } finally {
      setUploadingId(null);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">My tools</h1>
        <Link
          to="/tools/new"
          className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-600"
        >
          List a tool
        </Link>
      </div>

      <input
        ref={fileInput}
        type="file"
        accept="image/jpeg"
        className="hidden"
        onChange={(e) => onFile(e.target.files)}
      />

      {tools === null ? (
        <Spinner label="Loading your tools…" />
      ) : tools.length === 0 ? (
        <EmptyState
          title="You haven't listed anything yet"
          hint="Idle tools earn their keep here."
          action={
            <Link to="/tools/new" className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-600">
              List your first tool
            </Link>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {tools.map((t) => (
            <ToolCard
              key={t.toolId}
              tool={t}
              footer={
                <button
                  onClick={() => pickPhoto(t.toolId)}
                  disabled={uploadingId === t.toolId}
                  className="w-full rounded-lg border border-stone-300 py-1.5 text-sm font-medium hover:bg-stone-100 disabled:opacity-50 dark:border-stone-700 dark:hover:bg-stone-800"
                >
                  {uploadingId === t.toolId ? "Uploading…" : api.imageUrl(t) ? "Replace photo" : "Add photo"}
                </button>
              }
            />
          ))}
        </div>
      )}
    </main>
  );
}
