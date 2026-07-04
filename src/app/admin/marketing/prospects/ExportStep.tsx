"use client";

// Step 5 · Export — pick a saved list, choose columns & format, download.

import { useEffect, useState } from "react";
import type { SavedList } from "@/lib/prospects/saved-lists";

const COLUMNS: Array<{ key: string; label: string }> = [
  { key: "name", label: "Name" },
  { key: "email", label: "Email" },
  { key: "company", label: "Company" },
  { key: "lead_status", label: "Lead status" },
  { key: "side", label: "Side" },
  { key: "segment", label: "Segment" },
  { key: "email_status", label: "Email status" },
  { key: "lead_prescore", label: "Score" },
  { key: "phone", label: "Phone" },
  { key: "source", label: "Source" },
];
const DEFAULT_COLS = new Set(["name", "email", "company", "lead_status"]);
const card: React.CSSProperties = { background: "#fff", border: "0.5px solid #e2e6ed", borderRadius: 12, padding: 16, marginBottom: 12, boxShadow: "0 1px 3px rgb(12 35 64 / 0.06)" };

export function ExportStep() {
  const [lists, setLists] = useState<SavedList[]>([]);
  const [listId, setListId] = useState<string>("");
  const [cols, setCols] = useState<Set<string>>(new Set(DEFAULT_COLS));
  const [format, setFormat] = useState<"csv" | "xlsx">("csv");

  useEffect(() => {
    fetch("/api/prospects/lists").then((r) => (r.ok ? r.json() : [])).then((d) => {
      const arr = Array.isArray(d) ? d : [];
      setLists(arr);
      setListId((cur) => cur || (arr[0]?.id ?? ""));
    }).catch(() => {});
  }, []);

  function toggle(key: string) {
    setCols((prev) => { const n = new Set(prev); if (n.has(key)) n.delete(key); else n.add(key); return n; });
  }

  const ordered = COLUMNS.filter((c) => cols.has(c.key)).map((c) => c.key);
  const href = listId ? `/api/prospects/lists/${listId}/export?format=${format}&cols=${ordered.join(",")}` : "#";
  const selected = lists.find((l) => l.id === listId);

  return (
    <div>
      <div style={card}>
        <h3 style={{ fontSize: 13, fontWeight: 800, marginBottom: 4 }}>Export a saved list</h3>
        <p style={{ fontSize: 11.5, color: "var(--muted-foreground)", marginBottom: 14 }}>Pick a list, choose columns and format, then download. Pipeline columns (lead status, score, phone) are pulled fresh from the contact record.</p>

        {lists.length === 0 ? (
          <p style={{ fontSize: 12.5, color: "var(--muted-foreground)" }}>No saved lists yet — build one on the <b>Import</b> or <b>AI Approach</b> step first.</p>
        ) : (
          <>
            <label style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--muted-foreground)", display: "block", marginBottom: 5 }}>List</label>
            <select value={listId} onChange={(e) => setListId(e.target.value)} style={{ width: "100%", fontSize: 13, border: "0.5px solid var(--border-strong, #cbd5e1)", borderRadius: 8, padding: "8px 10px", marginBottom: 14, background: "var(--background)", color: "var(--foreground)" }}>
              {lists.map((l) => <option key={l.id} value={l.id}>{l.name} — {l.contact_count.toLocaleString()} contacts</option>)}
            </select>

            <label style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--muted-foreground)", display: "block", marginBottom: 6 }}>Columns</label>
            <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginBottom: 14 }}>
              {COLUMNS.map((c) => {
                const on = cols.has(c.key);
                return (
                  <button key={c.key} onClick={() => toggle(c.key)} style={{ fontSize: 11, fontWeight: 600, borderRadius: 999, padding: "4px 11px", cursor: "pointer", border: on ? "0.5px solid #93C5FD" : "0.5px solid var(--border)", background: on ? "#EFF6FF" : "#fff", color: on ? "#1A6CE4" : "var(--muted-foreground)" }}>
                    {on ? "✓ " : "＋ "}{c.label}
                  </button>
                );
              })}
            </div>

            <label style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--muted-foreground)", display: "block", marginBottom: 6 }}>Format</label>
            <div style={{ display: "flex", gap: 7, marginBottom: 16 }}>
              {(["csv", "xlsx"] as const).map((f) => (
                <button key={f} onClick={() => setFormat(f)} style={{ fontSize: 12, fontWeight: 700, borderRadius: 8, padding: "7px 16px", cursor: "pointer", border: format === f ? "1px solid #2E78F5" : "0.5px solid var(--border)", background: format === f ? "#EFF6FF" : "#fff", color: format === f ? "#1A6CE4" : "var(--muted-foreground)" }}>
                  {f === "csv" ? ".CSV" : ".XLSX (Excel)"}
                </button>
              ))}
            </div>

            <a
              href={ordered.length > 0 ? href : undefined}
              aria-disabled={ordered.length === 0}
              style={{ display: "inline-block", fontSize: 12.5, fontWeight: 700, padding: "9px 18px", borderRadius: 8, background: "#2E78F5", color: "#fff", textDecoration: "none", opacity: ordered.length === 0 ? 0.5 : 1, pointerEvents: ordered.length === 0 ? "none" : "auto" }}
            >
              Export {selected ? selected.contact_count.toLocaleString() : ""} contacts ↓
            </a>
            {ordered.length === 0 ? <p style={{ fontSize: 11, color: "#B91C1C", marginTop: 8 }}>Pick at least one column.</p> : null}
          </>
        )}
      </div>
    </div>
  );
}
