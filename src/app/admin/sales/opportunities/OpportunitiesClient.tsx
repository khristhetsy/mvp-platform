"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

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
type ImportSummary = {
  total: number; toCreate: number; skippedNoEmail: number; skippedDupInFile: number; skippedExisting: number;
  byStatus: { open: number; won: number; lost: number };
  sample: { title: string; email: string; status: string; linked: boolean; owner: boolean }[];
  created?: number;
};

export function OpportunitiesClient() {
  const [opps, setOpps] = useState<Opp[]>([]);
  const [stages, setStages] = useState<Stage[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<View>("list");
  const [filter, setFilter] = useState<Filter>("open");
  const [busy, setBusy] = useState(false);
  const viewAs = useSearchParams().get("viewAs");
  const viewQ = viewAs ? `&viewAs=${encodeURIComponent(viewAs)}` : "";

  const [importOpen, setImportOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importPreview, setImportPreview] = useState<ImportSummary | null>(null);
  const [importBusy, setImportBusy] = useState(false);
  const [importErr, setImportErr] = useState<string | null>(null);
  const [importDone, setImportDone] = useState<number | null>(null);
  const [importSource, setImportSource] = useState<"live" | "file">("live");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/sales/opportunities?archived=1${viewQ}`);
      const data = res.ok ? await res.json() : { opportunities: [], stages: [] };
      setOpps(data.opportunities ?? []);
      setStages(data.stages ?? []);
    } catch { setOpps([]); }
    setLoading(false);
  }, [viewQ]);

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

  function resetImport() { setImportOpen(false); setImportFile(null); setImportPreview(null); setImportErr(null); setImportDone(null); setImportBusy(false); setImportSource("live"); }

  async function runImport(mode: "preview" | "commit", source: "live" | "file", file: File | null) {
    setImportBusy(true); setImportErr(null);
    try {
      const fd = new FormData();
      fd.append("mode", mode); fd.append("source", source);
      if (file) fd.append("file", file);
      const res = await fetch("/api/admin/sales/opportunities/import", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) { setImportErr(data.error ?? "Import failed."); return; }
      setImportPreview(data);
      if (mode === "commit") { setImportDone(data.created ?? 0); await load(); }
    } catch { setImportErr("Import failed — please retry."); }
    finally { setImportBusy(false); }
  }

  function onImportFile(f: File | null) {
    setImportFile(f); setImportSource("file"); setImportPreview(null); setImportDone(null); setImportErr(null);
    if (f) void runImport("preview", "file", f);
  }
  function pullLive() {
    setImportSource("live"); setImportFile(null); setImportPreview(null); setImportDone(null); setImportErr(null);
    void runImport("preview", "live", null);
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
          <button onClick={() => setImportOpen(true)} style={{ ...btn("#fff", "#185FA5"), display: "inline-flex", alignItems: "center", gap: 5 }}>
            <i className="ti ti-download" aria-hidden="true" /> Import from Odoo
          </button>
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

      {importOpen && (
        <div onClick={resetImport} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 16 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 520, background: "#fff", borderRadius: 12, overflow: "hidden", boxShadow: "0 8px 24px rgba(0,0,0,0.18)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "13px 16px", borderBottom: "0.5px solid #eef1f5" }}>
              <span style={{ fontSize: 14, fontWeight: 600 }}>Import from Odoo</span>
              <button onClick={resetImport} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted-foreground)", fontSize: 16 }}><i className="ti ti-x" aria-hidden="true" /></button>
            </div>
            <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
              {importDone == null && (
                <>
                  <p style={{ fontSize: 12.5, color: "var(--muted-foreground)", margin: 0, lineHeight: 1.6 }}>
                    Pull opportunities straight from Odoo, or upload the <b>crm.lead</b> .xlsx export. Value comes in blank (Odoo amount kept as a note); duplicates already in iCapOS are skipped.
                  </p>
                  <button onClick={pullLive} disabled={importBusy} style={{ ...btn("#185FA5"), display: "inline-flex", alignItems: "center", gap: 6, alignSelf: "flex-start", opacity: importBusy ? 0.6 : 1 }}>
                    <i className="ti ti-cloud-download" aria-hidden="true" /> Pull live from Odoo
                  </button>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--muted-foreground)", fontSize: 11 }}>
                    <div style={{ flex: 1, height: 1, background: "#eef1f5" }} /> or upload a file <div style={{ flex: 1, height: 1, background: "#eef1f5" }} />
                  </div>
                  <input type="file" accept=".xlsx" onChange={(e) => onImportFile(e.target.files?.[0] ?? null)} style={{ fontSize: 12.5 }} />
                </>
              )}
              {importErr && <p style={{ fontSize: 12.5, color: "#A32D2D", margin: 0 }}>{importErr}</p>}
              {importBusy && <p style={{ fontSize: 12.5, color: "var(--muted-foreground)", margin: 0 }}>{importSource === "live" ? "Pulling from Odoo…" : "Reading file…"}</p>}

              {importPreview && (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}>
                    <div style={{ background: "var(--muted)", borderRadius: 8, padding: 10 }}><div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>{importDone != null ? "Imported" : "New"}</div><div style={{ fontSize: 22, fontWeight: 600, color: "#0F6E56" }}>{importDone != null ? importDone : importPreview.toCreate}</div></div>
                    <div style={{ background: "var(--muted)", borderRadius: 8, padding: 10 }}><div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>Already in iCapOS</div><div style={{ fontSize: 22, fontWeight: 600 }}>{importPreview.skippedExisting}</div></div>
                    <div style={{ background: "var(--muted)", borderRadius: 8, padding: 10 }}><div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>Skipped</div><div style={{ fontSize: 22, fontWeight: 600, color: "var(--muted-foreground)" }}>{importPreview.skippedNoEmail + importPreview.skippedDupInFile}</div></div>
                  </div>
                  <p style={{ fontSize: 11.5, color: "var(--muted-foreground)", margin: 0 }}>
                    {importPreview.total} rows · won {importPreview.byStatus.won} · lost {importPreview.byStatus.lost} · open {importPreview.byStatus.open}. Skipped = {importPreview.skippedNoEmail} no-email + {importPreview.skippedDupInFile} repeat email.
                  </p>
                  {importDone == null && importPreview.sample.length > 0 && (
                    <div style={{ border: "0.5px solid #eef1f5", borderRadius: 8, overflow: "hidden", fontSize: 12 }}>
                      {importPreview.sample.map((s, i) => (
                        <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: 8, padding: "7px 11px", borderTop: i ? "0.5px solid #f1f4f8" : "none" }}>
                          <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.title}</span>
                          <span style={{ color: "var(--muted-foreground)", flexShrink: 0 }}>{s.status}{s.linked ? " · linked" : ""}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, padding: "12px 16px", borderTop: "0.5px solid #eef1f5" }}>
              {importDone != null ? (
                <button onClick={resetImport} style={btn("#185FA5")}>Done</button>
              ) : (
                <>
                  <button onClick={resetImport} style={btn("#fff", "var(--muted-foreground)")}>Cancel</button>
                  <button onClick={() => runImport("commit", importSource, importFile)} disabled={!importPreview || importBusy || (importPreview?.toCreate ?? 0) === 0} style={{ ...btn("#0F6E56"), opacity: !importPreview || importBusy || (importPreview?.toCreate ?? 0) === 0 ? 0.5 : 1 }}>
                    {importBusy ? "Importing…" : `Import ${importPreview?.toCreate ?? 0} opportunities`}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
