"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { MassEmailComposer } from "@/components/marketing/MassEmailComposer";

type Stage = { id: string; name: string; sort_order: number; is_won: boolean };
type Opp = {
  id: string; title: string; contact_name: string | null; contact_email: string | null;
  stage_id: string | null; stage_name: string | null; value_cents: number | null;
  billing: "yearly" | "monthly"; probability: number | null; priority: number;
  status: "open" | "won" | "lost" | "archived"; notes: string | null; created_at: string;
  source: string | null; owner_id: string | null; owner_name: string | null;
};

const money = (c: number | null) => (c == null ? "—" : `$${(c / 100).toLocaleString()}`);
function mrr(o: Pick<Opp, "value_cents" | "billing">): string {
  if (o.value_cents == null) return "—";
  const cents = o.billing === "monthly" ? o.value_cents : Math.round(o.value_cents / 12);
  return `$${Math.round(cents / 100).toLocaleString()}`;
}
const sourceLabel = (o: Opp) => (o.source && o.source.toLowerCase() === "odoo" ? "Odoo" : o.source ? o.source : "Manual");
const ownerLabel = (o: Opp) => o.owner_name ?? "Unassigned";

type GroupBy = "none" | "stage" | "owner" | "status" | "source";
const GROUP_OPTIONS: { id: GroupBy; label: string }[] = [
  { id: "none", label: "None" }, { id: "stage", label: "Stage" }, { id: "owner", label: "Owner" },
  { id: "status", label: "Status" }, { id: "source", label: "Source" },
];

const OPT_COLS = [
  { key: "value", label: "Value", width: "0.8fr" },
  { key: "prob", label: "Prob.", width: "0.7fr" },
  { key: "mrr", label: "MRR", width: "0.9fr" },
  { key: "owner", label: "Owner", width: "1fr" },
  { key: "source", label: "Source", width: "0.7fr" },
  { key: "created", label: "Created", width: "0.9fr" },
] as const;
type ColKey = (typeof OPT_COLS)[number]["key"];

const STATUSES: Opp["status"][] = ["open", "won", "lost", "archived"];

type ImportSummary = {
  total: number; toCreate: number; skippedNoEmail: number; skippedDupInFile: number; skippedExisting: number;
  byStatus: { open: number; won: number; lost: number };
  sample: { title: string; email: string; status: string; linked: boolean; owner: boolean }[];
  created?: number;
};

function loadLS<T>(key: string, def: T): T {
  try { const v = window.localStorage.getItem(key); return v ? (JSON.parse(v) as T) : def; } catch { return def; }
}

export function OpportunitiesClient() {
  const [opps, setOpps] = useState<Opp[]>([]);
  const [stages, setStages] = useState<Stage[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const viewAs = useSearchParams().get("viewAs");
  const viewQ = viewAs ? `&viewAs=${encodeURIComponent(viewAs)}` : "";

  // Search + filters + grouping + columns (persisted).
  const [q, setQ] = useState("");
  const [fStatus, setFStatus] = useState<string[]>(() => loadLS<string[]>("opps.status2", []));
  const [fStages, setFStages] = useState<string[]>([]);
  const [fOwners, setFOwners] = useState<string[]>([]);
  const [fSources, setFSources] = useState<string[]>([]);
  const [minProb, setMinProb] = useState(0);
  const [hasValueOnly, setHasValueOnly] = useState(false);
  const [groupBy, setGroupBy] = useState<GroupBy>(() => loadLS<GroupBy>("opps.groupBy", "stage"));
  const [visibleCols, setVisibleCols] = useState<ColKey[]>(() => loadLS<ColKey[]>("opps.cols", ["value", "prob", "mrr"]));
  const [collapsed, setCollapsed] = useState<string[]>([]);

  const [filtersOpen, setFiltersOpen] = useState(false);
  const [colsOpen, setColsOpen] = useState(false);
  const [groupOpen, setGroupOpen] = useState(false);

  useEffect(() => { try { window.localStorage.setItem("opps.status2", JSON.stringify(fStatus)); } catch { /* ignore */ } }, [fStatus]);
  useEffect(() => { try { window.localStorage.setItem("opps.groupBy", JSON.stringify(groupBy)); } catch { /* ignore */ } }, [groupBy]);
  useEffect(() => { try { window.localStorage.setItem("opps.cols", JSON.stringify(visibleCols)); } catch { /* ignore */ } }, [visibleCols]);

  // Multi-select + mass email.
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [emailOpen, setEmailOpen] = useState(false);

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

  // Filter option universes derived from loaded data.
  const ownerOptions = useMemo(() => [...new Set(opps.map(ownerLabel))].sort(), [opps]);
  const sourceOptions = useMemo(() => [...new Set(opps.map(sourceLabel))].sort(), [opps]);
  const activeFilterCount = (fStatus.length ? 1 : 0) + (fStages.length ? 1 : 0) + (fOwners.length ? 1 : 0) + (fSources.length ? 1 : 0) + (minProb > 0 ? 1 : 0) + (hasValueOnly ? 1 : 0);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return opps.filter((o) => {
      if (needle) {
        const hay = `${o.title} ${o.contact_name ?? ""} ${o.contact_email ?? ""}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      if (fStatus.length && !fStatus.includes(o.status)) return false;
      if (fStages.length && !(o.stage_id && fStages.includes(o.stage_id))) return false;
      if (fOwners.length && !fOwners.includes(ownerLabel(o))) return false;
      if (fSources.length && !fSources.includes(sourceLabel(o))) return false;
      if (minProb > 0 && (o.probability == null || o.probability < minProb)) return false;
      if (hasValueOnly && o.value_cents == null) return false;
      return true;
    });
  }, [opps, q, fStatus, fStages, fOwners, fSources, minProb, hasValueOnly]);

  const groups = useMemo(() => {
    if (groupBy === "none") return null;
    const keyOf = (o: Opp) => groupBy === "stage" ? (o.stage_name ?? "No stage")
      : groupBy === "owner" ? ownerLabel(o)
      : groupBy === "status" ? o.status
      : sourceLabel(o);
    const map = new Map<string, Opp[]>();
    for (const o of filtered) { const k = keyOf(o); (map.get(k) ?? map.set(k, []).get(k)!).push(o); }
    return [...map.entries()].sort((a, b) => b[1].length - a[1].length);
  }, [filtered, groupBy]);

  const cols = OPT_COLS.filter((c) => visibleCols.includes(c.key));
  const gridCols = ["30px", "1.9fr", "1.1fr", ...cols.map((c) => c.width), "190px"].join(" ");

  // Selection helpers (over the loaded, filtered rows).
  const filteredIds = useMemo(() => filtered.map((o) => o.id), [filtered]);
  const allSelected = filteredIds.length > 0 && filteredIds.every((id) => selected.has(id));
  const selectionCount = selected.size;
  function toggleRow(id: string) { setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; }); }
  function toggleAll() { setSelected(allSelected ? new Set() : new Set(filteredIds)); }
  function clearSelection() { setSelected(new Set()); }
  async function bulkStatus(status: "won" | "archived") {
    const ids = [...selected]; if (!ids.length) return;
    setBusy(true);
    try { for (const id of ids) await fetch(`/api/sales/opportunities/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) }); clearSelection(); await load(); }
    finally { setBusy(false); }
  }

  const inp: React.CSSProperties = { fontSize: 12, padding: "6px 9px", borderRadius: 7, border: "0.5px solid var(--border)", background: "var(--background)", color: "var(--foreground)" };
  const btn = (bg: string, color = "#fff"): React.CSSProperties => ({ fontSize: 11, fontWeight: 600, color, background: bg, border: bg === "#fff" ? "0.5px solid var(--border-strong, #cbd5e1)" : "none", borderRadius: 6, padding: "4px 9px", cursor: "pointer" });
  const toolBtn = (active = false): React.CSSProperties => ({ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, padding: "6px 10px", borderRadius: 7, border: "0.5px solid var(--border-strong, #cbd5e1)", background: active ? "var(--muted)" : "#fff", color: "var(--foreground)", cursor: "pointer" });
  const pop: React.CSSProperties = { position: "absolute", top: "calc(100% + 6px)", right: 0, zIndex: 40, background: "#fff", border: "0.5px solid var(--border)", borderRadius: 10, boxShadow: "0 8px 24px rgba(0,0,0,0.12)", padding: 12, minWidth: 240 };
  const backdrop: React.CSSProperties = { position: "fixed", inset: 0, zIndex: 39 };
  const chip = (on: boolean): React.CSSProperties => ({ fontSize: 11.5, padding: "3px 9px", borderRadius: 999, cursor: "pointer", border: "0.5px solid var(--border)", background: on ? "#185FA5" : "var(--muted)", color: on ? "#fff" : "var(--muted-foreground)" });

  function toggle(list: string[], set: (v: string[]) => void, v: string) {
    set(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  }
  function toggleCol(k: ColKey) { setVisibleCols(visibleCols.includes(k) ? visibleCols.filter((c) => c !== k) : [...visibleCols, k]); }

  function cellValue(o: Opp, key: ColKey) {
    switch (key) {
      case "value": return <span style={{ color: "#185FA5" }}>{money(o.value_cents)}</span>;
      case "prob": return <span style={{ color: "#3B6D11" }}>{o.probability != null ? `${o.probability}%` : "—"}</span>;
      case "mrr": return <span style={{ color: "var(--muted-foreground)" }}>{mrr(o)}</span>;
      case "owner": return <span style={{ color: "var(--muted-foreground)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{ownerLabel(o)}</span>;
      case "source": return <span style={{ color: "var(--muted-foreground)" }}>{sourceLabel(o)}</span>;
      case "created": return <span style={{ color: "var(--muted-foreground)" }}>{new Date(o.created_at).toLocaleDateString()}</span>;
    }
  }

  function Row({ o }: { o: Opp }) {
    return (
      <div style={{ display: "grid", gridTemplateColumns: gridCols, padding: "11px 14px", borderTop: "0.5px solid #eef1f5", alignItems: "center", fontSize: 12.5, background: selected.has(o.id) ? "#F5F9FF" : undefined }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
          <input type="checkbox" checked={selected.has(o.id)} onChange={() => toggleRow(o.id)} aria-label={`Select ${o.title}`} style={{ width: 14, height: 14, cursor: "pointer" }} />
        </div>
        <div style={{ minWidth: 0 }}>
          <Link href={`/admin/sales/opportunities/${o.id}`} style={{ fontWeight: 500, color: "var(--foreground)", textDecoration: "none", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", display: "block" }}>{o.title}</Link>
          <div style={{ fontSize: 11, color: "var(--muted-foreground)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{o.contact_email ?? o.contact_name ?? "—"}</div>
        </div>
        <div>
          <select value={o.stage_id ?? ""} onChange={(e) => patch(o.id, { stageId: e.target.value })} disabled={busy || o.status === "archived"} style={{ ...inp, maxWidth: 140 }}>
            {stages.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        {cols.map((c) => <div key={c.key}>{cellValue(o, c.key)}</div>)}
        <div style={{ display: "flex", gap: 5, justifyContent: "flex-end", flexWrap: "wrap" }}>
          {o.status === "open" && <button type="button" onClick={() => patch(o.id, { status: "won" })} disabled={busy} style={btn("#0F6E56")}>Mark sold</button>}
          <Link href={`/admin/sales/opportunities/${o.id}`} style={{ ...btn("#fff", "#185FA5"), textDecoration: "none" }}>Open</Link>
          {o.status !== "archived" && <button type="button" onClick={() => patch(o.id, { status: "archived" })} disabled={busy} style={btn("#fff", "var(--muted-foreground)")}>Archive</button>}
          <button type="button" onClick={() => del(o.id)} disabled={busy} style={btn("#fff", "#A32D2D")}>Delete</button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ background: "#fff", border: "0.5px solid #e2e6ed", borderRadius: 12, overflow: "visible" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderBottom: "0.5px solid #eef1f5", flexWrap: "wrap" }}>
          <span style={{ fontSize: 12.5, fontWeight: 600 }}>Opportunities</span>
          <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>{filtered.length}{filtered.length !== opps.length ? ` / ${opps.length}` : ""}</span>
          <div style={{ flex: 1, minWidth: 160, display: "flex", alignItems: "center", gap: 6, border: "0.5px solid var(--border)", borderRadius: 8, padding: "6px 10px" }}>
            <i className="ti ti-search" style={{ color: "var(--muted-foreground)" }} aria-hidden="true" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search opportunity, contact, or email…" style={{ border: "none", outline: "none", background: "transparent", fontSize: 12.5, flex: 1, color: "var(--foreground)" }} />
            {q && <button type="button" onClick={() => setQ("")} style={{ border: "none", background: "none", cursor: "pointer", color: "var(--muted-foreground)" }}><i className="ti ti-x" aria-hidden="true" /></button>}
          </div>

          <div style={{ position: "relative" }}>
            <button type="button" onClick={() => setFiltersOpen((v) => !v)} style={toolBtn(activeFilterCount > 0)}>
              <i className="ti ti-filter" aria-hidden="true" /> Filters{activeFilterCount > 0 && <span style={{ background: "#185FA5", color: "#fff", borderRadius: 999, padding: "0 6px", fontSize: 10 }}>{activeFilterCount}</span>}
            </button>
            {filtersOpen && <>
              <div style={backdrop} onClick={() => setFiltersOpen(false)} />
              <div style={{ ...pop, minWidth: 280, maxHeight: 380, overflowY: "auto" }}>
                <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginBottom: 4 }}>Status</div>
                <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 10 }}>
                  {STATUSES.map((s) => <span key={s} onClick={() => toggle(fStatus, setFStatus, s)} style={chip(fStatus.includes(s))}>{s}</span>)}
                </div>
                <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginBottom: 4 }}>Stage</div>
                <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 10 }}>
                  {stages.map((s) => <span key={s.id} onClick={() => toggle(fStages, setFStages, s.id)} style={chip(fStages.includes(s.id))}>{s.name}</span>)}
                </div>
                <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginBottom: 4 }}>Owner</div>
                <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 10 }}>
                  {ownerOptions.map((o) => <span key={o} onClick={() => toggle(fOwners, setFOwners, o)} style={chip(fOwners.includes(o))}>{o}</span>)}
                </div>
                <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginBottom: 4 }}>Source</div>
                <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 10 }}>
                  {sourceOptions.map((o) => <span key={o} onClick={() => toggle(fSources, setFSources, o)} style={chip(fSources.includes(o))}>{o}</span>)}
                </div>
                <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginBottom: 4 }}>Probability ≥ {minProb}%</div>
                <input type="range" min={0} max={100} step={10} value={minProb} onChange={(e) => setMinProb(Number(e.target.value))} style={{ width: "100%", marginBottom: 10 }} />
                <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, cursor: "pointer", marginBottom: 10 }}>
                  <input type="checkbox" checked={hasValueOnly} onChange={(e) => setHasValueOnly(e.target.checked)} /> Has value only
                </label>
                <button type="button" onClick={() => { setFStatus([]); setFStages([]); setFOwners([]); setFSources([]); setMinProb(0); setHasValueOnly(false); }} style={{ ...btn("#fff", "var(--muted-foreground)"), width: "100%", padding: "6px" }}>Clear all</button>
              </div>
            </>}
          </div>

          <div style={{ position: "relative" }}>
            <button type="button" onClick={() => setColsOpen((v) => !v)} style={toolBtn()}><i className="ti ti-columns" aria-hidden="true" /> Columns</button>
            {colsOpen && <>
              <div style={backdrop} onClick={() => setColsOpen(false)} />
              <div style={pop}>
                {OPT_COLS.map((c) => (
                  <label key={c.key} style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12.5, padding: "4px 0", cursor: "pointer" }}>
                    <input type="checkbox" checked={visibleCols.includes(c.key)} onChange={() => toggleCol(c.key)} /> {c.label}
                  </label>
                ))}
              </div>
            </>}
          </div>

          <div style={{ position: "relative" }}>
            <button type="button" onClick={() => setGroupOpen((v) => !v)} style={toolBtn(groupBy !== "none")}>
              <i className="ti ti-layout-rows" aria-hidden="true" /> Group: {GROUP_OPTIONS.find((g) => g.id === groupBy)?.label} <i className="ti ti-chevron-down" aria-hidden="true" />
            </button>
            {groupOpen && <>
              <div style={backdrop} onClick={() => setGroupOpen(false)} />
              <div style={pop}>
                {GROUP_OPTIONS.map((g) => (
                  <button type="button" key={g.id} onClick={() => { setGroupBy(g.id); setGroupOpen(false); }} style={{ display: "block", width: "100%", textAlign: "left", fontSize: 12.5, padding: "6px 8px", borderRadius: 6, border: "none", background: groupBy === g.id ? "var(--muted)" : "transparent", cursor: "pointer", color: "var(--foreground)" }}>{g.label}</button>
                ))}
              </div>
            </>}
          </div>

          <Link href="/admin/sales/pipeline" style={{ ...toolBtn(), textDecoration: "none" }}><i className="ti ti-layout-kanban" aria-hidden="true" /> Kanban</Link>
          <button type="button" onClick={() => setImportOpen(true)} style={{ ...toolBtn(), color: "#185FA5" }}><i className="ti ti-download" aria-hidden="true" /> Import from Odoo</button>
        </div>

        {selectionCount > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 14px", background: "#E6F1FB", borderBottom: "0.5px solid #B5D4F4", flexWrap: "wrap" }}>
            <span style={{ fontSize: 12.5, color: "#0C447C", fontWeight: 500 }}>{selectionCount.toLocaleString()} selected</span>
            <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
              <button type="button" onClick={() => setEmailOpen(true)} style={{ fontSize: 12, fontWeight: 600, color: "#fff", background: "#2E78F5", border: "none", borderRadius: 7, padding: "6px 13px", cursor: "pointer" }}><i className="ti ti-mail" aria-hidden="true" /> Email</button>
              <button type="button" onClick={() => bulkStatus("won")} disabled={busy} style={{ fontSize: 12, color: "#0F6E56", background: "#fff", border: "0.5px solid #A7E0CE", borderRadius: 7, padding: "6px 12px", cursor: "pointer" }}>Mark sold</button>
              <button type="button" onClick={() => bulkStatus("archived")} disabled={busy} style={{ fontSize: 12, color: "#185FA5", background: "#fff", border: "0.5px solid #B5D4F4", borderRadius: 7, padding: "6px 12px", cursor: "pointer" }}>Archive</button>
              <button type="button" onClick={clearSelection} style={{ fontSize: 12, color: "var(--muted-foreground)", background: "#fff", border: "0.5px solid var(--border-strong, #cbd5e1)", borderRadius: 7, padding: "6px 12px", cursor: "pointer" }}>Clear</button>
            </div>
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: gridCols, padding: "8px 14px", background: "var(--muted)", fontSize: 10.5, fontWeight: 500, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center" }}><input type="checkbox" checked={allSelected} onChange={toggleAll} aria-label="Select all" style={{ width: 14, height: 14, cursor: "pointer" }} /></div>
          <div>Opportunity</div><div>Stage</div>{cols.map((c) => <div key={c.key}>{c.label}</div>)}<div></div>
        </div>

        {loading ? <p style={{ padding: 24, textAlign: "center", fontSize: 12.5, color: "var(--muted-foreground)" }}>Loading…</p>
          : filtered.length === 0 ? <p style={{ padding: 24, textAlign: "center", fontSize: 12.5, color: "var(--muted-foreground)" }}>No opportunities match. Adjust filters or import from Odoo.</p>
          : groups == null ? filtered.map((o) => <Row key={o.id} o={o} />)
          : groups.map(([key, list]) => {
              const isCollapsed = collapsed.includes(key);
              const sum = list.reduce((a, o) => a + (o.value_cents ?? 0), 0);
              return (
                <Fragment key={key}>
                  <div onClick={() => setCollapsed(isCollapsed ? collapsed.filter((k) => k !== key) : [...collapsed, key])} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 14px", background: "var(--muted)", borderTop: "0.5px solid #eef1f5", fontSize: 11.5, fontWeight: 600, cursor: "pointer" }}>
                    <i className={`ti ti-chevron-${isCollapsed ? "right" : "down"}`} aria-hidden="true" /> {key}
                    <span style={{ color: "var(--muted-foreground)", fontWeight: 400 }}>{list.length}{sum > 0 ? ` · ${money(sum)}` : ""}</span>
                  </div>
                  {!isCollapsed && list.map((o) => <Row key={o.id} o={o} />)}
                </Fragment>
              );
            })}
      </div>

      {emailOpen && (
        <MassEmailComposer source="opportunities" selection={{ mode: "ids", ids: [...selected], count: selected.size }} onClose={() => setEmailOpen(false)} />
      )}

      {importOpen && (
        <div onClick={resetImport} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 16 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 520, background: "#fff", borderRadius: 12, overflow: "hidden", boxShadow: "0 8px 24px rgba(0,0,0,0.18)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "13px 16px", borderBottom: "0.5px solid #eef1f5" }}>
              <span style={{ fontSize: 14, fontWeight: 600 }}>Import from Odoo</span>
              <button type="button" onClick={resetImport} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted-foreground)", fontSize: 16 }}><i className="ti ti-x" aria-hidden="true" /></button>
            </div>
            <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
              {importDone == null && (
                <>
                  <p style={{ fontSize: 12.5, color: "var(--muted-foreground)", margin: 0, lineHeight: 1.6 }}>
                    Pull opportunities straight from Odoo, or upload the <b>crm.lead</b> .xlsx export. Value comes in blank (Odoo amount kept as a note); duplicates already in iCapOS are skipped.
                  </p>
                  <button type="button" onClick={pullLive} disabled={importBusy} style={{ ...btn("#185FA5"), display: "inline-flex", alignItems: "center", gap: 6, alignSelf: "flex-start", opacity: importBusy ? 0.6 : 1 }}>
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
                <button type="button" onClick={resetImport} style={btn("#185FA5")}>Done</button>
              ) : (
                <>
                  <button type="button" onClick={resetImport} style={btn("#fff", "var(--muted-foreground)")}>Cancel</button>
                  <button type="button" onClick={() => runImport("commit", importSource, importFile)} disabled={!importPreview || importBusy || (importPreview?.toCreate ?? 0) === 0} style={{ ...btn("#0F6E56"), opacity: !importPreview || importBusy || (importPreview?.toCreate ?? 0) === 0 ? 0.5 : 1 }}>
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
