"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { MasterWithCount } from "@/lib/email/masters-queries";

export function EmailGalleryClient({ masters }: Readonly<{ masters: MasterWithCount[] }>) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<MasterWithCount | null>(null);

  async function startFromMaster(masterId: string) {
    setBusyId(masterId);
    setError(null);
    try {
      const res = await fetch("/api/marketing/email-templates/use", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ masterId }),
      });
      const json = (await res.json().catch(() => null)) as { copyId?: string; error?: string } | null;
      if (!res.ok || !json?.copyId) {
        setError(json?.error ?? "Couldn't create a copy.");
        return;
      }
      router.push(`/admin/marketing/templates/email/${json.copyId}`);
    } catch {
      setError("Couldn't create a copy. Check your connection and try again.");
    } finally {
      setBusyId(null);
    }
  }

  if (masters.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
        No master templates yet. Seed them with <code>npm run build:emails</code> and run the generated migration.
      </div>
    );
  }

  return (
    <>
      {error ? (
        <p className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>
      ) : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {masters.map((m) => (
          <div key={m.id} className="flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="flex h-28 items-center justify-center bg-gradient-to-br from-[#0A1A40] to-[#1A6CE4] text-sm font-semibold text-white">
              {m.name}
            </div>
            <div className="flex flex-1 flex-col p-4">
              <div className="text-sm font-medium text-slate-900">{m.name}</div>
              <p className="mt-1 flex-1 text-xs leading-relaxed text-slate-500">{m.description}</p>
              <div className="mt-2 text-[11px] text-slate-400">
                {m.copy_count} {m.copy_count === 1 ? "copy" : "copies"}
              </div>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => void startFromMaster(m.id)}
                  disabled={busyId === m.id}
                  className="flex-1 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {busyId === m.id ? "Creating…" : "Use template"}
                </button>
                <button
                  type="button"
                  onClick={() => setPreview(m)}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50"
                >
                  Preview
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {preview ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-6"
          onClick={() => setPreview(null)}
        >
          <div
            className="flex max-h-[90vh] w-full max-w-[680px] flex-col overflow-hidden rounded-xl bg-white"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <div className="text-sm font-medium">{preview.name} — preview</div>
              <button
                type="button"
                onClick={() => setPreview(null)}
                className="rounded-md border border-slate-200 px-3 py-1 text-xs text-slate-600 hover:bg-slate-50"
              >
                Close
              </button>
            </div>
            {/* Master preview: compiled HTML with unfilled {{slots}} visible as-is. */}
            <div className="overflow-auto bg-[#f4f7fc] p-4">
              <div
                className="mx-auto max-w-[600px] overflow-hidden rounded-lg bg-white"
                dangerouslySetInnerHTML={{ __html: preview.compiled_html }}
              />
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
