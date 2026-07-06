"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

type Stage = { id: string; pipeline_id: string; name: string; sort_order: number; is_won: boolean };
type Pipeline = { id: string; name: string; is_default: boolean; stages: Stage[] };
type BoardOpp = { id: string; title: string; value_cents: number | null; billing: "yearly" | "monthly"; probability: number | null; priority: number; stage_id: string | null; pipeline_id: string | null; contact_name: string | null; updated_at: string | null };

const money = (c: number | null) => (c == null ? "" : `$${(c / 100).toLocaleString()}`);
const moneyShort = (c: number) => (c >= 1000 ? `$${Math.round(c / 100000)}k` : `$${Math.round(c / 100)}`);
const STAGE_ACCENTS = ["#2E78F5", "#EF9F27", "#639922", "#888780", "#4338CA", "#0F6E56"];
const isStalled = (o: BoardOpp) => o.updated_at != null && Date.now() - new Date(o.updated_at).getTime() > 14 * 86400000;

export function PipelineClient() {
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [board, setBoard] = useState<BoardOpp[]>([]);
  const [selId, setSelId] = useState<string>("");
  const [view, setView] = useState<"board" | "stages">("board");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/sales/pipelines");
    if (!res.ok) return;
    const data = await res.json();
    setPipelines(data.pipelines ?? []);
    setBoard(data.board ?? []);
    setSelId((cur) => cur || (data.pipelines?.[0]?.id ?? ""));
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- load pipelines on mount
  useEffect(() => { void load(); }, [load]);

  const pipeline = pipelines.find((p) => p.id === selId) ?? null;

  async function call(url: string, method: string, body?: unknown) {
    setBusy(true);
    try { await fetch(url, { method, headers: body ? { "Content-Type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined }); await load(); }
    finally { setBusy(false); }
  }

  async function newPipeline() {
    const name = window.prompt("New pipeline name")?.trim();
    if (name) await call("/api/sales/pipelines", "POST", { name });
  }
  async function renamePipeline() {
    if (!pipeline) return;
    const name = window.prompt("Rename pipeline", pipeline.name)?.trim();
    if (name) await call(`/api/sales/pipelines/${pipeline.id}`, "PATCH", { name });
  }
  async function addStage() {
    if (!pipeline) return;
    const name = window.prompt("New stage name")?.trim();
    if (name) await call("/api/sales/stages", "POST", { pipelineId: pipeline.id, name });
  }
  async function renameStage(s: Stage) {
    const name = window.prompt("Rename stage", s.name)?.trim();
    if (name) await call(`/api/sales/stages/${s.id}`, "PATCH", { name });
  }
  async function moveStage(s: Stage, dir: -1 | 1) {
    if (!pipeline) return;
    const sorted = [...pipeline.stages].sort((a, b) => a.sort_order - b.sort_order);
    const idx = sorted.findIndex((x) => x.id === s.id);
    const other = sorted[idx + dir];
    if (!other) return;
    await Promise.all([
      fetch(`/api/sales/stages/${s.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sortOrder: other.sort_order }) }),
      fetch(`/api/sales/stages/${other.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sortOrder: s.sort_order }) }),
    ]);
    await load();
  }
  async function moveOpp(oppId: string, stageId: string) { await call(`/api/sales/opportunities/${oppId}`, "PATCH", { stageId }); }

  const stages = (pipeline?.stages ?? []).slice().sort((a, b) => a.sort_order - b.sort_order);

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
        <select value={selId} onChange={(e) => setSelId(e.target.value)} style={{ fontSize: 12.5, fontWeight: 600, padding: "6px 10px", borderRadius: 8, border: "1px solid #2E78F5", background: "#EFF6FF", color: "#1A6CE4" }}>
          {pipelines.map((p) => <option key={p.id} value={p.id}>{p.name}{p.is_default ? " (default)" : ""}</option>)}
        </select>
        <button onClick={newPipeline} style={{ fontSize: 12, color: "var(--muted-foreground)", background: "#fff", border: "0.5px solid var(--border-strong, #cbd5e1)", borderRadius: 8, padding: "6px 11px", cursor: "pointer" }}>+ New pipeline</button>
        {pipeline && <button onClick={renamePipeline} style={{ fontSize: 12, color: "var(--muted-foreground)", background: "none", border: "none", cursor: "pointer" }}>Rename</button>}
        <div style={{ marginLeft: "auto", display: "inline-flex", border: "0.5px solid var(--border-strong, #cbd5e1)", borderRadius: 8, overflow: "hidden" }}>
          <button onClick={() => setView("board")} style={{ fontSize: 12, padding: "6px 12px", border: "none", background: view === "board" ? "#EFF6FF" : "#fff", color: view === "board" ? "#1A6CE4" : "var(--muted-foreground)", fontWeight: view === "board" ? 600 : 400, cursor: "pointer" }}>Board</button>
          <button onClick={() => setView("stages")} style={{ fontSize: 12, padding: "6px 12px", border: "none", borderLeft: "0.5px solid var(--border-strong, #cbd5e1)", background: view === "stages" ? "#EFF6FF" : "#fff", color: view === "stages" ? "#1A6CE4" : "var(--muted-foreground)", fontWeight: view === "stages" ? 600 : 400, cursor: "pointer" }}>Edit stages</button>
        </div>
      </div>

      {view === "board" ? (
        <div style={{ display: "flex", gap: 12, overflowX: "auto", paddingBottom: 8 }}>
          {stages.map((s, si) => {
            const cards = board.filter((o) => o.stage_id === s.id);
            const total = cards.reduce((a, o) => a + (o.value_cents ?? 0), 0);
            const accent = s.is_won ? "#0F6E56" : STAGE_ACCENTS[si % STAGE_ACCENTS.length];
            return (
              <div key={s.id} style={{ minWidth: 220, flex: "0 0 220px", background: "var(--muted)", borderRadius: 12, padding: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                  <span style={{ fontSize: 12, fontWeight: 600 }}>{s.name}</span>
                  {s.is_won && <span style={{ fontSize: 9, color: "#0F6E56", background: "#E1F5EE", borderRadius: 4, padding: "0 5px" }}>won</span>}
                  <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--muted-foreground)" }}>{cards.length}{total > 0 ? ` · ${moneyShort(total)}` : ""}</span>
                </div>
                <div style={{ height: 3, background: accent, borderRadius: 2, marginBottom: 10 }} />
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {cards.map((o) => (
                    <div key={o.id} style={{ background: "#fff", border: "0.5px solid #e2e6ed", borderRadius: 9, padding: "9px 11px" }}>
                      <Link href={`/admin/sales/opportunities/${o.id}`} style={{ fontSize: 12, fontWeight: 500, color: "var(--foreground)", textDecoration: "none", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", display: "block" }}>{o.title}</Link>
                      <div style={{ fontSize: 11, color: "#185FA5", marginTop: 2 }}>{o.value_cents != null ? money(o.value_cents) : ""}{o.contact_name ? <span style={{ color: "var(--muted-foreground)" }}> · {o.contact_name}</span> : ""}</div>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 6 }}>
                        {isStalled(o) ? <span style={{ fontSize: 10, color: "#A32D2D" }}><i className="ti ti-clock" aria-hidden="true" /> stalled</span>
                          : o.priority > 0 ? <span style={{ fontSize: 11, color: "#EF9F27" }}>{"★".repeat(o.priority)}</span>
                          : <span />}
                        {o.probability != null && <span style={{ fontSize: 10, color: "#3B6D11" }}>{o.probability}%</span>}
                      </div>
                      <select value={s.id} onChange={(e) => moveOpp(o.id, e.target.value)} disabled={busy} style={{ marginTop: 7, width: "100%", fontSize: 10.5, padding: "3px 5px", borderRadius: 6, border: "0.5px solid var(--border)", background: "var(--background)", color: "var(--muted-foreground)" }}>
                        {stages.map((st) => <option key={st.id} value={st.id}>Move → {st.name}</option>)}
                      </select>
                    </div>
                  ))}
                  {cards.length === 0 && <div style={{ fontSize: 11, color: "var(--muted-foreground)", textAlign: "center", padding: "10px 0" }}>—</div>}
                </div>
              </div>
            );
          })}
          {stages.length === 0 && <p style={{ fontSize: 12.5, color: "var(--muted-foreground)" }}>No stages. Add some in “Edit stages”.</p>}
        </div>
      ) : (
        <div style={{ background: "#fff", border: "0.5px solid #e2e6ed", borderRadius: 12, overflow: "hidden", maxWidth: 620 }}>
          <div style={{ padding: "10px 14px", borderBottom: "0.5px solid #e2e6ed", display: "flex", alignItems: "center" }}>
            <span style={{ fontSize: 12.5, fontWeight: 600 }}>Stages · {pipeline?.name}</span>
            <button onClick={addStage} style={{ marginLeft: "auto", fontSize: 11.5, fontWeight: 600, color: "#fff", background: "#2E78F5", border: "none", borderRadius: 6, padding: "5px 11px", cursor: "pointer" }}>+ Add stage</button>
          </div>
          {stages.map((s, i) => (
            <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderTop: "0.5px solid #eef1f5", fontSize: 12.5 }}>
              <span style={{ fontSize: 11, color: "var(--muted-foreground)", width: 18 }}>{i + 1}</span>
              <span style={{ flex: 1, fontWeight: 500 }}>{s.name}</span>
              <button onClick={() => call(`/api/sales/stages/${s.id}`, "PATCH", { isWon: !s.is_won })} disabled={busy} style={{ fontSize: 10.5, fontWeight: 600, color: s.is_won ? "#0F6E56" : "var(--muted-foreground)", background: s.is_won ? "#E1F5EE" : "#fff", border: "0.5px solid var(--border)", borderRadius: 6, padding: "3px 8px", cursor: "pointer" }}>Won stage</button>
              <button onClick={() => moveStage(s, -1)} disabled={busy || i === 0} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted-foreground)", opacity: i === 0 ? 0.3 : 1 }}>↑</button>
              <button onClick={() => moveStage(s, 1)} disabled={busy || i === stages.length - 1} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted-foreground)", opacity: i === stages.length - 1 ? 0.3 : 1 }}>↓</button>
              <button onClick={() => renameStage(s)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted-foreground)", fontSize: 12 }}>✎</button>
              <button onClick={() => { if (confirm(`Delete stage "${s.name}"? Opportunities in it become unstaged.`)) void call(`/api/sales/stages/${s.id}`, "DELETE"); }} style={{ background: "none", border: "none", cursor: "pointer", color: "#A32D2D", fontSize: 12 }}>🗑</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
