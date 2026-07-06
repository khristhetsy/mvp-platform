"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";

type Stage = { id: string; name: string; sort_order: number; is_won: boolean };
type Opp = {
  id: string; title: string; contact_name: string | null; contact_email: string | null;
  stage_id: string | null; stage_name: string | null; value_cents: number | null;
  billing: "yearly" | "monthly"; probability: number | null; priority: number;
  status: "open" | "won" | "lost" | "archived"; notes: string | null; created_at: string;
};

const money = (c: number | null) => (c == null ? "—" : `$${(c / 100).toLocaleString()}`);
function mrr(o: Pick<Opp, "value_cents" | "billing">): string {
  if (o.value_cents == null) return "—";
  const cents = o.billing === "monthly" ? o.value_cents : Math.round(o.value_cents / 12);
  return `$${Math.round(cents / 100).toLocaleString()}`;
}
const GRID = "1.9fr 1.1fr 0.8fr 0.7fr 0.9fr 190px";

type Filter = "open" | "won" | "lost" | "all";
type View = "list" | "stage";

export function OpportunitiesClient() {
  const [opps, setOpps] = useState<Opp[]>([]);
  const [stages, setStages] = useState<Stage[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<View>("list");
  const [filter, setFilter] = useState<Filter>("open");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/sales/opportunities?archived=1`);
      const data = res.ok ? await res.json() : { opportunities: [], stages: [] };
      setOpps(data.opportunities ?? []);
      setStages(data.stages ?? []);
    } catch { setOpps([]); }
    setLoading(false);
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- load on mount
  useEffect(() => { void load(); }, [load]);

  async function patch(id: string, body: Record<string, unknown>) {
    setBusy(true);
    try { await fetch(`/api/sales/opportunities/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); await load(); }
    finally { setBusy(false); }
  }
  async function del(id: string) {
    if (!confirm("Delete this opportunity permanently?")) return;
    setBusy(true);
    try { await fetch(`/api/sales/opportunities/${id}`, { method: "DELETE" }); await load(); }
    finally { setBusy(false); }
  }

  const filtered = useMemo(() => opps.filter((o) => {
    if (filter === "all") return true;
    if (filter === "open") return o.status === "open";
    if (filter === "won") return o.status === "won";
    if (filter === "lost") return o.status === "lost" || o.status === "archived";
    return true;
  }), [opps, filter]);

  const inp: React.CSSProperties = { fontSize: 12, padding: "6px 9px", borderRadius: 7, border: "0.5px solid var(--border)", background: "var(--background)", color: "var(--foreground)" };
  const btn = (bg: string, color = "#fff"): React.CSSProperties => ({ fontSize: 11, fontWeight: 600, color, background: bg, border: bg === "#fff" ? "0.5px solid var(--border-strong, #cbd5e1)" : "none", borderRadius: 6, padding: "4px 9px", cursor: "pointer" });
  const viewTab = (active: boolean): React.CSSProperties => ({ fontSize: 11, color: active ? "#fff" : "var(--muted-foreground)", background: active ? "#2E78F5" : "transparent", borderRadius: 5, padding: "5px 10px", cursor: "pointer", border: "none" });

  function Row({ o }: { o: Opp }) {
    return (
      <div style={{ display: "grid", gridTemplateColumns: GRID, padding: "11px 14px", borderTop: "0.5px solid #eef1f5", alignItems: "center", fontSize: 12.5 }}>
        <div style={{ minWidth: 0 }}>
          <Link href={`/admin/sales/opportunities/${o.id}`} style={{ fontWeight: 500, color: "var(--foreground)", textDecoration: "none", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", display: "block" }}>{o.title}</Link>
          <div style={{ fontSize: 11, color: "var(--muted-foreground)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{o.contact_email ?? o.contact_name ?? "—"}</div>
        </div>
        <div>
          <select value={o.stage_id ?? ""} onChange={(e) => patch(o.id, { stageId: e.target.value })} disabled={busy || o.status === "archived"} style={{ ...inp, maxWidth: 140 }}>
            {stages.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div style={{ color: "#185FA5" }}>{money(o.value_cents)}</div>
        <div style={{ color: "#3B6D11" }}>{o.probability != null ? `${o.probability}%` : "—"}</div>
        <div style={{ color: "var(--muted-foreground)" }}>{mrr(o)}</div>
        <div style={{ display: "flex", gap: 5, justifyContent: "flex-end", flexWrap: "wrap" }}>
          {o.status === "open" && <button onClick={() => patch(o.id, { status: "won" })} disabled={busy} style={btn("#0F6E56")}>Mark sold</button>}
          <Link href={`/admin/sales/opportunities/${o.id}`} style={{ ...btn("#fff", "#185FA5"), textDecoration: "none" }}>Open</Link>
          {o.status !== "archived" && <button onClick={() => patch(o.id, { status: "archived" })} disabled={busy} style={btn("#fff", "var(--muted-foreground)")}>Archive</button>}
          <button onClick={() => del(o.id)} disabled={busy} style={btn("#fff", "#A32D2D")}>Delete</button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ background: "#fff", border: "0.5px solid #e2e6ed", borderRadius: 12, overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderBottom: "0.5px solid #eef1f5", flexWrap: "wrap" }}>
          <span style={{ fontSize: 12.5, fontWeight: 600 }}>Opportunities</span>
          <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>{filtered.length}</span>
          <div style={{ flex: 1 }} />
          <div style={{ display: "flex", background: "var(--muted)", borderRadius: 7, padding: 2 }}>
            <button onClick={() => setView("list")} style={viewTab(view === "list")}>List</button>
            <Link href="/admin/sales/pipeline" style={{ ...viewTab(false), textDecoration: "none" }}>Kanban</Link>
            <button onClick={() => setView("stage")} style={viewTab(view === "stage")}>By stage</button>
          </div>
          <select value={filter} onChange={(e) => setFilter(e.target.value as Filter)} style={inp}>
            <option value="open">All open</option>
            <option value="won">Won</option>
            <option value="lost">Lost / archived</option>
            <option value="all">All</option>
          </select>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: GRID, padding: "8px 14px", background: "var(--muted)", fontSize: 10.5, fontWeight: 500, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
          <div>Opportunity</div><div>Stage</div><div>Value</div><div>Prob.</div><div>MRR</div><div></div>
        </div>

        {loading ? <p style={{ padding: 24, textAlign: "center", fontSize: 12.5, color: "var(--muted-foreground)" }}>Loading…</p>
          : filtered.length === 0 ? <p style={{ padding: 24, textAlign: "center", fontSize: 12.5, color: "var(--muted-foreground)" }}>No opportunities. Convert a contact from the Contacts tab.</p>
          : view === "list" ? filtered.map((o) => <Row key={o.id} o={o} />)
          : stages.map((s) => {
              const inStage = filtered.filter((o) => o.stage_id === s.id);
              if (inStage.length === 0) return null;
              return (
                <Fragment key={s.id}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 14px", background: "var(--muted)", borderTop: "0.5px solid #eef1f5", fontSize: 11.5, fontWeight: 600 }}>
                    {s.name} <span style={{ color: "var(--muted-foreground)", fontWeight: 400 }}>{inStage.length} · {money(inStage.reduce((a, o) => a + (o.value_cents ?? 0), 0))}</span>
                  </div>
                  {inStage.map((o) => <Row key={o.id} o={o} />)}
                </Fragment>
              );
            })}
      </div>
    </div>
  );
}
