"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type SaveStatus = "idle" | "saving" | "saved" | "error";

export function InvestorOpportunityNoteInput({ companyId }: { companyId: string }) {
  const [note, setNote] = useState<string>("");
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [loaded, setLoaded] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load existing note on mount
  useEffect(() => {
    let cancelled = false;
    void fetch(`/api/investor/opportunities/${companyId}/note`)
      .then((r) => r.json())
      .then((data: { note?: string | null }) => {
        if (!cancelled) {
          setNote(data.note ?? "");
          setLoaded(true);
        }
      })
      .catch(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => { cancelled = true; };
  }, [companyId]);

  const persist = useCallback(async (value: string) => {
    setStatus("saving");
    try {
      const res = await fetch(`/api/investor/opportunities/${companyId}/note`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: value }),
      });
      if (!res.ok) throw new Error("save failed");
      setStatus("saved");
    } catch {
      setStatus("error");
    }
  }, [companyId]);

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const value = e.target.value;
    setNote(value);
    setStatus("idle");

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void persist(value);
    }, 700);
  }

  const statusText =
    status === "saving" ? "Saving…" :
    status === "saved"  ? "Saved" :
    status === "error"  ? "Save failed — retry" :
    null;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Private note</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Only you can see this — synced to your watchlist
          </p>
        </div>
        {statusText && (
          <span
            className={`text-[11px] font-medium ${
              status === "error" ? "text-red-500" :
              status === "saved" ? "text-emerald-600" :
              "text-slate-400"
            }`}
          >
            {statusText}
          </span>
        )}
      </div>
      <div className="p-4">
        {loaded ? (
          <textarea
            value={note}
            onChange={handleChange}
            placeholder="Add a private note about this company — thesis fit, questions, follow-up items…"
            rows={4}
            className="w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
          />
        ) : (
          <div className="h-[100px] animate-pulse rounded-lg bg-slate-100" />
        )}
      </div>
    </div>
  );
}
