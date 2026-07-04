"use client";

import { useState } from "react";
import type { BriefItem, BriefPriority } from "@/lib/cmo/brief";

const PRIORITY_STYLE: Record<BriefPriority, { bg: string; color: string; label: string }> = {
  critical: { bg: "#FEF2F2", color: "#B91C1C", label: "Critical" },
  high: { bg: "#FFFBEB", color: "#92400E", label: "High" },
  medium: { bg: "#EFF6FF", color: "#1D4ED8", label: "Medium" },
  low: { bg: "#F1F5F9", color: "#475569", label: "Low" },
};

export function BriefClient({ items }: { items: BriefItem[] }) {
  const [added, setAdded] = useState<Record<string, boolean>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function addToTask(item: BriefItem) {
    setBusyId(item.id); setError(null);
    try {
      const res = await fetch("/api/cmo/task", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: item.taskTitle,
          description: `${item.taskDescription}\n\nSource: ${item.citation}`,
          priority: item.priority === "critical" ? "high" : item.priority === "low" ? "low" : item.priority,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not create task.");
      setAdded((a) => ({ ...a, [item.id]: true }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create task.");
    } finally {
      setBusyId(null);
    }
  }

  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200/80 bg-white p-8 text-center text-sm text-slate-500 shadow-[var(--shadow-panel)]">
        Nothing needs attention right now. Check back after the next sync or scoring run.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {items.map((item) => {
        const p = PRIORITY_STYLE[item.priority];
        return (
          <div key={item.id} className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[var(--shadow-panel)]">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase" style={{ background: p.bg, color: p.color }}>{p.label}</span>
                  <p className="text-sm font-semibold text-slate-950">{item.title}</p>
                </div>
                <p className="mt-1 text-sm text-slate-600">{item.rationale}</p>
                <p className="mt-1 text-[11px] text-slate-400">Source: {item.citation}</p>
              </div>
            </div>
            <div className="mt-3 flex items-center gap-3">
              <a href={item.href} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-50">Open →</a>
              {added[item.id] ? (
                <span className="text-xs font-medium text-emerald-700">✓ Added to tasks</span>
              ) : (
                <button
                  type="button"
                  disabled={busyId === item.id}
                  onClick={() => addToTask(item)}
                  className="rounded-lg bg-[#2E78F5] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                >
                  {busyId === item.id ? "Adding…" : "Add to task"}
                </button>
              )}
            </div>
          </div>
        );
      })}
      {error ? <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p> : null}
    </div>
  );
}
