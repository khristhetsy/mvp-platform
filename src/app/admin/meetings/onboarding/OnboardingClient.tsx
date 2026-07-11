"use client";

import Link from "next/link";
import { useState } from "react";

const NAVY = "#0A1A40", BLUE = "#1A6CE4", MUTED = "var(--muted-foreground)";
interface Item { key: string; label: string }
interface OItem { item_key: string; done: boolean }
interface Record_ { id: string; company_name: string; added_on: string; conference_ready: boolean; items: OItem[]; done: number; total: number }

export function OnboardingClient({ initial, items }: { initial: Record_[]; items: Item[] }) {
  const [records, setRecords] = useState<Record_[]>(initial);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const readyCount = records.filter((r) => r.conference_ready).length;

  const add = async () => {
    if (!name.trim()) return;
    setBusy(true);
    try {
      const r = await fetch("/api/admin/meetings/onboarding", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ company_name: name.trim() }) });
      const d = await r.json();
      if (r.ok && d.id) {
        setRecords((p) => [...p, { id: d.id, company_name: name.trim(), added_on: new Date().toISOString().slice(0, 10), conference_ready: false, items: items.map((i) => ({ item_key: i.key, done: false })), done: 0, total: items.length }].sort((a, b) => a.company_name.localeCompare(b.company_name)));
        setName("");
      }
    } finally { setBusy(false); }
  };

  const toggle = async (rec: Record_, itemKey: string, done: boolean) => {
    setRecords((p) => p.map((r) => {
      if (r.id !== rec.id) return r;
      const its = r.items.map((i) => (i.item_key === itemKey ? { ...i, done } : i));
      const doneCount = its.filter((i) => i.done).length;
      return { ...r, items: its, done: doneCount, conference_ready: doneCount === (r.total || items.length) };
    }));
    await fetch(`/api/admin/meetings/onboarding/${rec.id}/items`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ item_key: itemKey, done }) }).catch(() => {});
  };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10, marginBottom: 14 }}>
        <div>
          <Link href="/admin/meetings" style={{ fontSize: 12, color: BLUE, textDecoration: "none" }}>← Meetings</Link>
          <h1 style={{ fontSize: 21, fontWeight: 600, color: NAVY, margin: "6px 0 0" }}>Client Onboarding</h1>
          <p style={{ fontSize: 12.5, color: MUTED, margin: "2px 0 0" }}>Collateral checklist per company · {readyCount} conference-ready</p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void add(); }} placeholder="Company name" style={{ fontSize: 12.5, padding: "7px 10px", borderRadius: 8, border: "0.5px solid var(--border)", width: 200 }} />
          <button onClick={() => void add()} disabled={busy || !name.trim()} style={{ fontSize: 12, fontWeight: 600, color: "#fff", background: BLUE, border: "none", borderRadius: 8, padding: "7px 12px", cursor: "pointer" }}>+ Add company</button>
        </div>
      </div>

      {records.length === 0 ? <p style={{ fontSize: 12.5, color: MUTED }}>No companies onboarding yet. Add one to start its checklist.</p> : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {records.map((r) => {
            const pct = r.total ? Math.round((r.done / r.total) * 100) : 0;
            const open = expanded === r.id;
            return (
              <div key={r.id} style={{ background: "#fff", border: "0.5px solid var(--border)", borderRadius: 11, overflow: "hidden" }}>
                <button onClick={() => setExpanded(open ? null : r.id)} style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "11px 14px", background: "none", border: "none", cursor: "pointer", textAlign: "left" }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: NAVY, flex: 1 }}>{r.company_name}</span>
                  {r.conference_ready && <span style={{ fontSize: 10, fontWeight: 700, background: "#E1F5EE", color: "#0F6E56", borderRadius: 6, padding: "2px 8px" }}>CONFERENCE-READY</span>}
                  <span style={{ fontSize: 11.5, color: MUTED, fontVariantNumeric: "tabular-nums" }}>{r.done}/{r.total}</span>
                  <div style={{ width: 120, height: 6, background: "#F1EFE8", borderRadius: 99, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${pct}%`, background: r.conference_ready ? "#1D9E75" : BLUE, borderRadius: 99 }} />
                  </div>
                  <span style={{ fontSize: 11, color: MUTED }}>{open ? "▲" : "▼"}</span>
                </button>
                {open && (
                  <div style={{ padding: "4px 14px 12px", borderTop: "0.5px solid #F1F4F9", display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 4 }}>
                    {items.map((it) => {
                      const done = r.items.find((i) => i.item_key === it.key)?.done ?? false;
                      return (
                        <label key={it.key} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, padding: "4px 0", cursor: "pointer" }}>
                          <input type="checkbox" checked={done} onChange={(e) => void toggle(r, it.key, e.target.checked)} />
                          <span style={{ color: done ? MUTED : NAVY, textDecoration: done ? "line-through" : "none" }}>{it.label}</span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
