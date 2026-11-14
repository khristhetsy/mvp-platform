"use client";
import { useState } from "react";

export type SuggestionItem = {
  id: string; reason: string; to_stage_name?: string | null; from_stage_name?: string | null;
};

/**
 * The automation suggestion on an opportunity page: why a move is proposed, with
 * Approve and Keep buttons. Picking a stage by hand in the stage bar cancels it.
 */
export function AutomationSuggestion({ items, onDecided }: { items: SuggestionItem[]; onDecided: () => void }) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [gone, setGone] = useState<string[]>([]);
  const visible = items.filter((i) => !gone.includes(i.id));
  if (visible.length === 0) return null;

  async function decide(id: string, decision: "approve" | "keep") {
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch(`/api/sales/automation/approvals/${id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ decision }) });
      const d = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) { setError(d.error ?? "Could not save your answer."); return; }
      setGone((g) => [...g, id]);
      onDecided();
    } finally { setBusyId(null); }
  }

  return (
    <div style={{ display: "grid", gap: 8, margin: "0 16px 4px" }}>
      {visible.map((s) => (
        <div key={s.id} role="status" style={{ background: "#E6F1FB", border: "0.5px solid #B5D4F4", borderRadius: 10, padding: "11px 13px" }}>
          <div style={{ fontSize: 12.5, fontWeight: 600, color: "#0A1A40" }}>
            <i className="ti ti-bolt" aria-hidden="true" /> Automation suggests moving this to {s.to_stage_name ?? "the next stage"}
          </div>
          <div style={{ fontSize: 12, color: "#185FA5", margin: "3px 0 9px" }}>Because {s.reason}.{s.from_stage_name ? ` Now in ${s.from_stage_name}.` : ""}</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <button type="button" disabled={busyId === s.id} onClick={() => decide(s.id, "approve")} style={{ fontSize: 12, fontWeight: 600, color: "#fff", background: "#2E78F5", border: "none", borderRadius: 7, padding: "7px 14px", cursor: "pointer", opacity: busyId === s.id ? 0.6 : 1 }}>Approve move</button>
            <button type="button" disabled={busyId === s.id} onClick={() => decide(s.id, "keep")} style={{ fontSize: 12, color: "var(--muted-foreground)", background: "transparent", border: "0.5px solid var(--border-strong, #cbd5e1)", borderRadius: 7, padding: "7px 14px", cursor: "pointer" }}>Keep in {s.from_stage_name ?? "current stage"}</button>
          </div>
        </div>
      ))}
      {error && <div style={{ fontSize: 11.5, color: "#A32D2D" }}>{error}</div>}
    </div>
  );
}
