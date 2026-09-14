"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { MassEmailComposer } from "@/components/marketing/MassEmailComposer";
import { SelectionBar, ActionResult, runBulk, type SelectionAction } from "@/components/admin/sales/SelectionBar";
import { OdooSearchBar, EMPTY_SEARCH, textMatch, type SearchState } from "@/components/admin/OdooSearchBar";
import { ToolbarGear, NewButton, downloadCsv, type GearItem } from "@/components/admin/ToolbarGear";
import { SalesViewControl } from "@/app/admin/sales/SalesViewControl";

type Stage = { id: string; name: string; sort_order: number; is_won: boolean };
type Opp = {
  id: string; title: string; contact_name: string | null; contact_email: string | null;
  stage_id: string | null; stage_name: string | null; value_cents: number | null;
  billing: "yearly" | "monthly"; probability: number | null; priority: number;
  status: "open" | "won" | "lost" | "archived"; notes: string | null; created_at: string;
  source: string | null; owner_id: string | null; owner_name: string | null;
  expected_close?: string | null; tags?: string[]; updated_at?: string | null;
  activity?: { type: string; title: string; due: string | null; state: "overdue" | "today" | "planned" | "done" | "none" } | null;
  sequence?: { name: string; step: number; steps: number } | null;
};
type SeqOption = { id: string; name: string; status: string; steps: number };

const money = (c: number | null) => (c == null ? "—" : `$${(c / 100).toLocaleString()}`);
function mrr(o: Pick<Opp, "value_cents" | "billing">): string {
  if (o.value_cents == null) return "—";
  const cents = o.billing === "monthly" ? o.value_cents : Math.round(o.value_cents / 12);
  return `$${Math.round(cents / 100).toLocaleString()}`;
}
const sourceLabel = (o: Opp) => (o.source && o.source.toLowerCase() === "odoo" ? "Odoo" : o.source ? o.source : "Manual");
const ownerLabel = (o: Opp) => o.owner_name ?? "Unassigned";

type GroupBy = "none" | "stage" | "owner" | "status" | "source" | "close_month" | "created_month";
const GROUP_OPTIONS: { id: GroupBy; label: string }[] = [
  { id: "none", label: "None" }, { id: "stage", label: "Stage" }, { id: "owner", label: "Owner" },
  { id: "status", label: "Status" }, { id: "source", label: "Source" },
  { id: "close_month", label: "Expected close (month)" }, { id: "created_month", label: "Created (month)" },
];
const QUICK_FILTERS = [
  { key: "open", label: "Open" }, { key: "won", label: "Won" }, { key: "lost", label: "Lost" }, { key: "archived", label: "Archived" },
  { key: "mine", label: "My opportunities", sep: true }, { key: "unassigned", label: "Unassigned" }, { key: "has_value", label: "Has value" },
  { key: "prob50", label: "Probability ≥ 50%" }, { key: "closing_month", label: "Closing this month" }, { key: "stalled", label: "Stalled (14d)" },
  { key: "no_stage", label: "No stage", sep: true },
];
const monthOf = (iso: string | null | undefined) => (iso ? iso.slice(0, 7) : "");
const isStalled = (o: Opp) => o.status === "open" && Date.now() - new Date(o.updated_at ?? o.created_at).getTime() > 14 * 86400000;

const OPT_COLS = [
  { key: "value", label: "Value", width: "0.8fr" },
  { key: "prob", label: "Prob.", width: "0.7fr" },
  { key: "mrr", label: "MRR", width: "0.9fr" },
  { key: "owner", label: "Owner", width: "1fr" },
  { key: "source", label: "Source", width: "0.7fr" },
  { key: "created", label: "Created", width: "0.9fr" },
  { key: "activities", label: "Activities", width: "1.3fr" },
  { key: "sequence", label: "Sequence", width: "1.1fr" },
] as const;
type ColKey = (typeof OPT_COLS)[number]["key"];

type ImportSummary = {
  total: number; toCreate: number; skippedNoEmail: number; skippedDupInFile: number; skippedExisting: number;
  byStatus: { open: number; won: number; lost: number };
  sample: { title: string; email: string; status: string; linked: boolean; owner: boolean }[];
  created?: number;
};

function loadLS<T>(key: string, def: T): T {
  try { const v = window.localStorage.getItem(key); return v ? (JSON.parse(v) as T) : def; } catch { return def; }
}

export function OpportunitiesClient({ canExport = false, meId = "" }: { canExport?: boolean; meId?: string } = {}) {
  const [opps, setOpps] = useState<Opp[]>([]);
  const [stages, setStages] = useState<Stage[]>([]);
  const [staff, setStaff] = useState<{ id: string; name: string }[]>([]);
  const [sequences, setSequences] = useState<SeqOption[]>([]);
  // Enroll in sequence: preview (counts) → confirm → commit.
  const [enroll, setEnroll] = useState<{ seq: SeqOption; ids: string[]; preview?: { enrolled: number; skippedNoEmail: number; alreadyEnrolled: number; total: number }; error?: string } | null>(null);
  const [actionResult, setActionResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const viewAs = useSearchParams().get("viewAs");
  const viewQ = viewAs ? `&viewAs=${encodeURIComponent(viewAs)}` : "";

  // Search + filters + grouping live in one Odoo-style bar state (persisted); columns separately.
  const [search, setSearch] = useState<SearchState>(() => loadLS<SearchState>("opps.search.v1", { ...EMPTY_SEARCH, groupBy: "stage" }));
  const groupBy = (search.groupBy || "none") as GroupBy;
  const [visibleCols, setVisibleCols] = useState<ColKey[]>(() => loadLS<ColKey[]>("opps.cols.v2", ["value", "prob", "mrr", "activities"]));
  const [collapsed, setCollapsed] = useState<string[]>([]);

  const [colsOpen, setColsOpen] = useState(false);

  useEffect(() => { try { window.localStorage.setItem("opps.search.v1", JSON.stringify(search)); } catch { /* ignore */ } }, [search]);
  useEffect(() => { try { window.localStorage.setItem("opps.cols.v2", JSON.stringify(visibleCols)); } catch { /* ignore */ } }, [visibleCols]);

  // Multi-select + mass email.
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [emailOpen, setEmailOpen] = useState(false);

  const [importOpen, setImportOpen] = useState(false);
  // New opportunity (inline, like Add contact on Contacts).
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ name: "", email: "", company: "", value: "" });
  const [addErr, setAddErr] = useState<string | null>(null);
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
      setStaff(data.staff ?? []);
      setSequences(data.sequences ?? []);
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

  async function addOpportunity() {
    if (!draft.name.trim()) return;
    setBusy(true); setAddErr(null);
    try {
      const cents = draft.value.trim() ? Math.round(Number(draft.value.replace(/[^0-9.]/g, "")) * 100) : null;
      const res = await fetch("/api/sales/opportunities", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: draft.name.trim(), email: draft.email.trim() || null, company: draft.company.trim() || null, valueCents: Number.isFinite(cents) ? cents : null }) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok || !d.opportunity) throw new Error(d.error ?? "Couldn't create the opportunity.");
      setAdding(false); setDraft({ name: "", email: "", company: "", value: "" });
      await load();
    } catch (e) { setAddErr(e instanceof Error ? e.message : "Couldn't create the opportunity."); } finally { setBusy(false); }
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
  const tagOptions = useMemo(() => [...new Set(opps.flatMap((o) => o.tags ?? []))].sort(), [opps]);
  const stageNameById = useMemo(() => new Map(stages.map((s) => [s.id, s.name])), [stages]);
  const searchFields = useMemo(() => [
    { key: "stage", label: "Stage", options: [...stages.map((s) => s.name), "No stage"] },
    { key: "owner", label: "Owner", options: ownerOptions },
    { key: "source", label: "Source", options: sourceOptions },
    { key: "tags", label: "Tags", options: tagOptions },
  ], [stages, ownerOptions, sourceOptions, tagOptions]);

  const filtered = useMemo(() => {
    const { q, quick, fields } = search;
    const statuses = (["open", "won", "lost", "archived"] as const).filter((st) => quick.includes(st));
    const thisMonth = new Date().toISOString().slice(0, 7);
    return opps.filter((o) => {
      if (!textMatch(q, o.title, o.contact_name, o.contact_email)) return false;
      if (statuses.length && !statuses.includes(o.status)) return false;
      if (quick.includes("mine") && o.owner_id !== meId) return false;
      if (quick.includes("unassigned") && o.owner_id) return false;
      if (quick.includes("has_value") && o.value_cents == null) return false;
      if (quick.includes("prob50") && (o.probability == null || o.probability < 50)) return false;
      if (quick.includes("closing_month") && monthOf(o.expected_close) !== thisMonth) return false;
      if (quick.includes("stalled") && !isStalled(o)) return false;
      if (quick.includes("no_stage") && o.stage_id && stageNameById.has(o.stage_id)) return false;
      if (fields.stage?.length && !fields.stage.includes((o.stage_id && stageNameById.get(o.stage_id)) || "No stage")) return false;
      if (fields.owner?.length && !fields.owner.includes(ownerLabel(o))) return false;
      if (fields.source?.length && !fields.source.includes(sourceLabel(o))) return false;
      if (fields.tags?.length && !(o.tags ?? []).some((t) => fields.tags.includes(t))) return false;
      return true;
    });
  }, [opps, search, meId, stageNameById]);

  function exportAll() {
    downloadCsv(`opportunities-${new Date().toISOString().slice(0, 10)}.csv`,
      ["Opportunity", "Contact", "Email", "Stage", "Status", "Owner", "Value", "Billing", "Probability", "Expected close", "Source", "Created"],
      filtered.map((o) => [o.title, o.contact_name, o.contact_email, o.stage_name, o.status, ownerLabel(o), o.value_cents == null ? "" : (o.value_cents / 100).toFixed(2), o.billing, o.probability ?? "", o.expected_close ?? "", sourceLabel(o), o.created_at.slice(0, 10)]));
  }
  const gearItems: GearItem[] = [
    { key: "odoo", icon: "ti-cloud-download", label: "Import from Odoo", onClick: () => setImportOpen(true) },
    ...(canExport ? [{ key: "export", icon: "ti-download", label: "Export all", hint: `${filtered.length.toLocaleString()} matching`, onClick: exportAll } as GearItem] : []),
    { key: "cols", icon: "ti-columns", label: "Columns", sep: true, onClick: () => setColsOpen(true) },
    { key: "kanban", icon: "ti-layout-kanban", label: "Kanban board", href: "/admin/sales/pipeline" },
    { key: "stages", icon: "ti-adjustments", label: "Edit stages", href: "/admin/sales/pipeline?view=stages" },
  ];

  const groups = useMemo(() => {
    if (groupBy === "none") return null;
    const keyOf = (o: Opp) => groupBy === "stage" ? (o.stage_name ?? "No stage")
      : groupBy === "owner" ? ownerLabel(o)
      : groupBy === "status" ? o.status
      : groupBy === "close_month" ? (monthOf(o.expected_close) || "No close date")
      : groupBy === "created_month" ? monthOf(o.created_at)
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
  // One request for the whole selection (was one PATCH per row, serially).
  async function bulk(body: Record<string, unknown>, verb: string) {
    const ids = [...selected]; if (!ids.length) return;
    setBusy(true); setActionResult(null);
    try {
      const r = await runBulk("/api/sales/opportunities/bulk", { ...body, ids });
      if (!r.ok) { setActionResult(r.error); return; }
      setActionResult(r.file ? `Exported ${ids.length.toLocaleString()} opportunit${ids.length === 1 ? "y" : "ies"} to ${r.file}.` : `${verb} ${r.count.toLocaleString()} opportunit${r.count === 1 ? "y" : "ies"}${r.failed ? ` — ${r.failed} failed` : ""}.`);
      if (!r.file) { clearSelection(); await load(); }
    } finally { setBusy(false); }
  }
  async function openEnroll(seqId: string) {
    const seq = sequences.find((x) => x.id === seqId); const ids = [...selected];
    if (!seq || !ids.length) return;
    setEnroll({ seq, ids });
    const r = await runBulk("/api/sales/opportunities/bulk", { op: "enroll", ids, sequenceId: seq.id, mode: "preview" }) as unknown as { ok: boolean; error?: string; enrolled?: number; skippedNoEmail?: number; alreadyEnrolled?: number; total?: number };
    if (!r.ok) { setEnroll({ seq, ids, error: r.error ?? "Couldn't check the selection." }); return; }
    setEnroll({ seq, ids, preview: { enrolled: r.enrolled ?? 0, skippedNoEmail: r.skippedNoEmail ?? 0, alreadyEnrolled: r.alreadyEnrolled ?? 0, total: r.total ?? ids.length } });
  }
  async function commitEnroll() {
    if (!enroll) return;
    setBusy(true);
    try {
      const r = await runBulk("/api/sales/opportunities/bulk", { op: "enroll", ids: enroll.ids, sequenceId: enroll.seq.id, mode: "commit" }) as unknown as { ok: boolean; error?: string; enrolled?: number; skippedNoEmail?: number; alreadyEnrolled?: number };
      if (!r.ok) { setActionResult(r.error ?? "Enroll failed."); return; }
      setActionResult(`Enrolled ${r.enrolled ?? 0} contact${r.enrolled === 1 ? "" : "s"} in ${enroll.seq.name}${r.skippedNoEmail ? ` · ${r.skippedNoEmail} skipped (no email)` : ""}${r.alreadyEnrolled ? ` · ${r.alreadyEnrolled} already enrolled` : ""}.`);
      setEnroll(null); clearSelection(); await load();
    } finally { setBusy(false); }
  }
  const selectionActions: SelectionAction[] = [
    { key: "email", icon: "ti-mail", label: "Email", run: () => setEmailOpen(true) },
    { key: "enroll", icon: "ti-send", label: "Enroll in sequence", options: sequences.map((sq) => ({ value: sq.id, label: `${sq.name}${sq.status !== "active" ? ` (${sq.status})` : ""} · ${sq.steps} step${sq.steps === 1 ? "" : "s"}` })), runWith: (id) => void openEnroll(id) },
    { key: "stage", icon: "ti-arrow-right", label: "Move to stage", options: stages.map((s) => ({ value: s.id, label: s.name })), runWith: (stageId) => void bulk({ op: "stage", stageId }, `Moved`) },
    { key: "owner", icon: "ti-user", label: "Assign owner", options: [{ value: "", label: "Unassigned" }, ...staff.map((s) => ({ value: s.id, label: s.name }))], runWith: (ownerId) => void bulk({ op: "owner", ownerId: ownerId || null }, "Reassigned") },
    { key: "won", icon: "ti-check", label: "Mark sold", run: () => void bulk({ op: "status", status: "won" }, "Marked sold") },
    ...(canExport ? [{ key: "export", icon: "ti-download", label: "Export CSV", run: () => void bulk({ op: "export" }, "Exported") } as SelectionAction] : []),
    { key: "archive", icon: "ti-archive", label: "Archive", run: () => void bulk({ op: "status", status: "archived" }, "Archived") },
  ];

  const inp: React.CSSProperties = { fontSize: 12, padding: "6px 9px", borderRadius: 7, border: "0.5px solid var(--border)", background: "var(--background)", color: "var(--foreground)" };
  const btn = (bg: string, color = "#fff"): React.CSSProperties => ({ fontSize: 11, fontWeight: 600, color, background: bg, border: bg === "#fff" ? "0.5px solid var(--border-strong, #cbd5e1)" : "none", borderRadius: 6, padding: "4px 9px", cursor: "pointer" });
  const toolBtn = (active = false): React.CSSProperties => ({ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, padding: "6px 10px", borderRadius: 7, border: "0.5px solid var(--border-strong, #cbd5e1)", background: active ? "var(--muted)" : "#fff", color: "var(--foreground)", cursor: "pointer" });
  const pop: React.CSSProperties = { position: "absolute", top: "calc(100% + 6px)", right: 0, zIndex: 40, background: "#fff", border: "0.5px solid var(--border)", borderRadius: 10, boxShadow: "0 8px 24px rgba(0,0,0,0.12)", padding: 12, minWidth: 240 };
  const backdrop: React.CSSProperties = { position: "fixed", inset: 0, zIndex: 39 };

  function toggleCol(k: ColKey) { setVisibleCols(visibleCols.includes(k) ? visibleCols.filter((c) => c !== k) : [...visibleCols, k]); }

  function cellValue(o: Opp, key: ColKey) {
    switch (key) {
      case "value": return <span style={{ color: "#185FA5" }}>{money(o.value_cents)}</span>;
      case "prob": return <span style={{ color: "#3B6D11" }}>{o.probability != null ? `${o.probability}%` : "—"}</span>;
      case "mrr": return <span style={{ color: "var(--muted-foreground)" }}>{mrr(o)}</span>;
      case "owner": return <span style={{ color: "var(--muted-foreground)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{ownerLabel(o)}</span>;
      case "source": return <span style={{ color: "var(--muted-foreground)" }}>{sourceLabel(o)}</span>;
      case "created": return <span style={{ color: "var(--muted-foreground)" }}>{new Date(o.created_at).toLocaleDateString()}</span>;
      case "activities": {
        const a = o.activity;
        if (!a || a.state === "none") return <span style={{ color: "var(--muted-foreground)", fontSize: 11.5 }}>—</span>;
        const today = new Date().toISOString().slice(0, 10);
        const when = a.state === "done" ? "Done" : !a.due ? "No date" : a.state === "today" ? "Today" : a.state === "overdue" ? `${Math.round((Date.parse(today) - Date.parse(a.due)) / 86400000)}d overdue` : a.due;
        const color = a.state === "overdue" ? "#A32D2D" : a.state === "today" ? "#854F0B" : a.state === "done" ? "#0F6E56" : "#3B6D11";
        return (
          <span style={{ display: "flex", alignItems: "center", gap: 5, minWidth: 0, fontSize: 11.5 }} title={`${a.type}: ${a.title}${a.due ? ` · ${a.due}` : ""}`}>
            <i className={`ti ${a.state === "done" ? "ti-check" : "ti-clock"}`} style={{ color, flexShrink: 0 }} aria-hidden="true" />
            <span style={{ color, flexShrink: 0 }}>{a.type}</span>
            <span style={{ color: "var(--muted-foreground)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>· {when}{a.title ? ` · ${a.title}` : ""}</span>
          </span>
        );
      }
      case "sequence": return o.sequence
        ? <span style={{ fontSize: 11.5, color: "#3C3489", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", display: "block" }} title={o.sequence.name}>{o.sequence.name} · step {o.sequence.step}/{o.sequence.steps}</span>
        : <span style={{ color: "var(--muted-foreground)" }}>—</span>;
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
          <select value={o.stage_id && stageNameById.has(o.stage_id) ? o.stage_id : ""} onChange={(e) => patch(o.id, { stageId: e.target.value })} disabled={busy || o.status === "archived"} style={{ ...inp, maxWidth: 140, color: o.stage_id && stageNameById.has(o.stage_id) ? undefined : "#A32D2D" }}>
            {!(o.stage_id && stageNameById.has(o.stage_id)) && <option value="">— No stage —</option>}
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
          <NewButton onClick={() => setAdding((v) => !v)} />
          <ToolbarGear items={gearItems} heading="Opportunities" />
          <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>{filtered.length}{filtered.length !== opps.length ? ` / ${opps.length}` : ""}</span>
          <OdooSearchBar scope="opportunities" state={search} onChange={setSearch} quick={QUICK_FILTERS} fields={searchFields} groups={GROUP_OPTIONS} noGroupId="none" placeholder="Search opportunity, contact, or email…" width={520} />

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

          <SalesViewControl />
        </div>

        {adding && (
          <div style={{ padding: "10px 14px", borderBottom: "0.5px solid #eef1f5", background: "#F5F9FF", display: "grid", gridTemplateColumns: "1.4fr 1.4fr 1fr 0.7fr auto", gap: 8, alignItems: "center" }}>
            <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Contact name *" autoFocus style={inp} />
            <input value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} placeholder="Email" style={inp} />
            <input value={draft.company} onChange={(e) => setDraft({ ...draft, company: e.target.value })} placeholder="Company" style={inp} />
            <input value={draft.value} onChange={(e) => setDraft({ ...draft, value: e.target.value })} placeholder="Value $" style={inp} />
            <div style={{ display: "flex", gap: 6 }}>
              <button type="button" onClick={() => void addOpportunity()} disabled={busy || !draft.name.trim()} style={{ ...btn("#0F6E56"), opacity: busy || !draft.name.trim() ? 0.5 : 1 }}>Create</button>
              <button type="button" onClick={() => { setAdding(false); setAddErr(null); }} style={{ fontSize: 12, color: "var(--muted-foreground)", background: "none", border: "none", cursor: "pointer" }}><i className="ti ti-x" aria-hidden="true" /></button>
            </div>
            {addErr && <div style={{ gridColumn: "1 / -1", fontSize: 11.5, color: "#A32D2D" }}>{addErr}</div>}
          </div>
        )}

        <ActionResult text={actionResult} onClose={() => setActionResult(null)} />
        <SelectionBar count={selectionCount} total={filteredIds.length} onSelectAll={() => setSelected(new Set(filteredIds))} onClear={clearSelection} actions={selectionActions} busy={busy} heading="Selected opportunities" />

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

      {enroll && (
        <div onClick={() => { if (!busy) setEnroll(null); }} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 16 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 440, background: "#fff", borderRadius: 12, padding: 18, boxShadow: "0 8px 24px rgba(0,0,0,0.18)" }}>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>Enroll {enroll.ids.length.toLocaleString()} opportunit{enroll.ids.length === 1 ? "y" : "ies"} in {enroll.seq.name}?</div>
            {enroll.error ? <p style={{ fontSize: 12.5, color: "#A32D2D", margin: "0 0 12px" }}>{enroll.error}</p>
              : !enroll.preview ? <p style={{ fontSize: 12.5, color: "var(--muted-foreground)", margin: "0 0 12px" }}>Checking the selection…</p>
              : (
                <p style={{ fontSize: 12.5, color: "var(--muted-foreground)", margin: "0 0 12px", lineHeight: 1.6 }}>
                  <b style={{ color: "#0F6E56" }}>{enroll.preview.enrolled}</b> will be enrolled{enroll.preview.skippedNoEmail ? <> · <b>{enroll.preview.skippedNoEmail}</b> have no email</> : null}{enroll.preview.alreadyEnrolled ? <> · <b>{enroll.preview.alreadyEnrolled}</b> already in this sequence</> : null}{enroll.preview.total < enroll.ids.length ? <> · <b>{enroll.ids.length - enroll.preview.total}</b> not found</> : null}.
                  {enroll.seq.status !== "active" && <> The sequence is <b>{enroll.seq.status}</b> — nothing sends until it&rsquo;s activated.</>} The first step goes out on the next batch run and passes through the approver.
                </p>
              )}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button type="button" onClick={() => setEnroll(null)} disabled={busy} style={btn("#fff", "var(--muted-foreground)")}>Cancel</button>
              <button type="button" onClick={() => void commitEnroll()} disabled={busy || !enroll.preview || enroll.preview.enrolled === 0} style={{ ...btn("#2E78F5"), opacity: busy || !enroll.preview || enroll.preview.enrolled === 0 ? 0.5 : 1 }}>{busy ? "Enrolling…" : `Enroll ${enroll.preview?.enrolled ?? ""}`}</button>
            </div>
          </div>
        </div>
      )}

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
