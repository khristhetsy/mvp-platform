"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { SelectionBar, ActionResult, runBulk, type SelectionAction } from "@/components/admin/sales/SelectionBar";
import { OdooSearchBar, EMPTY_SEARCH, textMatch, type SearchState } from "@/components/admin/OdooSearchBar";
import { ToolbarGear, NewButton, downloadCsv, type GearItem } from "@/components/admin/ToolbarGear";
import { SalesViewControl } from "@/app/admin/sales/SalesViewControl";
import { HScrollBoard } from "@/components/admin/HScrollBoard";

type Stage = { id: string; pipeline_id: string; name: string; sort_order: number; is_won: boolean; sequence_id: string | null };
type SeqOption = { id: string; name: string; status: string };
type Pipeline = { id: string; name: string; is_default: boolean; stages: Stage[] };
type BoardOpp = { id: string; title: string; value_cents: number | null; billing: "yearly" | "monthly"; probability: number | null; priority: number; stage_id: string | null; pipeline_id: string | null; contact_name: string | null; updated_at: string | null; owner_id: string | null; owner_name: string | null; source: string | null; expected_close: string | null; created_at: string };

const money = (c: number | null) => (c == null ? "" : `$${(c / 100).toLocaleString()}`);
const moneyShort = (c: number) => (c >= 1000 ? `$${Math.round(c / 100000)}k` : `$${Math.round(c / 100)}`);
const STAGE_ACCENTS = ["#2E78F5", "#EF9F27", "#639922", "#888780", "#4338CA", "#0F6E56"];
const isStalled = (o: BoardOpp) => o.updated_at != null && Date.now() - new Date(o.updated_at).getTime() > 14 * 86400000;
const ownerLabel = (o: BoardOpp) => o.owner_name ?? "Unassigned";
const sourceLabel = (o: BoardOpp) => (o.source && o.source.toLowerCase() === "odoo" ? "Odoo" : o.source ? o.source : "Manual");

const PIPE_QUICK = [
  { key: "mine", label: "My deals" }, { key: "unassigned", label: "Unassigned" }, { key: "has_value", label: "Has value" },
  { key: "prob50", label: "Probability ≥ 50%" }, { key: "closing_month", label: "Closing this month" }, { key: "stalled", label: "Stalled (14d)" },
];
const PIPE_GROUPS = [
  { id: "none", label: "None" }, { id: "stage", label: "Stage" }, { id: "owner", label: "Owner" }, { id: "source", label: "Source" },
  { id: "close_month", label: "Expected close (month)" }, { id: "created_month", label: "Created (month)" },
];

function loadLS<T>(key: string, def: T): T {
  try { const v = window.localStorage.getItem(key); return v ? (JSON.parse(v) as T) : def; } catch { return def; }
}

export function PipelineClient({ canExport = false, meId = "" }: { canExport?: boolean; meId?: string } = {}) {
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [board, setBoard] = useState<BoardOpp[]>([]);
  const [staff, setStaff] = useState<{ id: string; name: string }[]>([]);
  const [selId, setSelId] = useState<string>("");
  // "list" is the line view: same deals as the board, one row each, with selection.
  const [view, setView] = useState<"board" | "list" | "stages">(() => loadLS<"board" | "list" | "stages">("pipeline.view", "board"));
  // Search + filters (shared by Board and List) + group-by (List only) in one Odoo bar.
  const [search, setSearch] = useState<SearchState>(() => loadLS<SearchState>("pipeline.search.v1", { ...EMPTY_SEARCH, groupBy: "none" }));
  useEffect(() => { try { window.localStorage.setItem("pipeline.search.v1", JSON.stringify(search)); } catch { /* ignore */ } }, [search]);
  // List view selection + bulk actions.
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [actionResult, setActionResult] = useState<string | null>(null);
  useEffect(() => { try { window.localStorage.setItem("pipeline.view", JSON.stringify(view)); } catch { /* ignore */ } }, [view]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ name: "", company: "", value: "" });
  const [sequences, setSequences] = useState<SeqOption[]>([]);
  // Delete-stage modal: choose where the stage's deals go, surface guard errors.
  const [delTarget, setDelTarget] = useState<Stage | null>(null);
  const [reassignTo, setReassignTo] = useState<string>("");
  const [delErr, setDelErr] = useState<string | null>(null);
  const [delBusy, setDelBusy] = useState(false);
  const searchParams = useSearchParams();
  const viewAs = searchParams.get("viewAs");
  const viewParam = searchParams.get("view");
  // eslint-disable-next-line react-hooks/set-state-in-effect -- deep link (?view=stages) from the Opportunities gear
  useEffect(() => { if (viewParam === "stages" || viewParam === "list" || viewParam === "board") setView(viewParam); }, [viewParam]);
  const viewQ = viewAs ? `?viewAs=${encodeURIComponent(viewAs)}` : "";

  const load = useCallback(async () => {
    const res = await fetch(`/api/sales/pipelines${viewQ}`);
    if (!res.ok) return;
    const data = await res.json();
    setPipelines(data.pipelines ?? []);
    setBoard(data.board ?? []);
    setStaff(data.staff ?? []);
    setSelId((cur) => cur || (data.pipelines?.[0]?.id ?? ""));
  }, [viewQ]);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- load pipelines on mount
  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    let active = true;
    fetch("/api/sales/sequences")
      .then((r) => (r.ok ? r.json() : { sequences: [] }))
      .then((d) => { if (active) setSequences(d.sequences ?? []); })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  const pipeline = pipelines.find((p) => p.id === selId) ?? null;

  async function call(url: string, method: string, body?: unknown) {
    setBusy(true); setErr(null);
    try {
      const res = await fetch(url, { method, headers: body ? { "Content-Type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
      if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error || "That action couldn’t be completed.");
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "That action couldn’t be completed.");
    } finally { setBusy(false); }
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
  async function confirmDeleteStage() {
    if (!delTarget) return;
    setDelBusy(true); setDelErr(null);
    try {
      const qs = reassignTo ? `?reassignTo=${encodeURIComponent(reassignTo)}` : "";
      const res = await fetch(`/api/sales/stages/${delTarget.id}${qs}`, { method: "DELETE" });
      if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error || "Delete failed.");
      setDelTarget(null); setReassignTo("");
      await load();
    } catch (e) {
      setDelErr(e instanceof Error ? e.message : "Delete failed.");
    } finally { setDelBusy(false); }
  }

  const stages = useMemo(() => (pipeline?.stages ?? []).slice().sort((a, b) => a.sort_order - b.sort_order), [pipeline]);
  const stageName = useMemo(() => new Map(stages.map((s) => [s.id, s.name])), [stages]);
  async function addDeal() {
    if (!draft.name.trim()) return;
    const cents = draft.value.trim() ? Math.round(Number(draft.value.replace(/[^0-9.]/g, "")) * 100) : null;
    await call("/api/sales/opportunities", "POST", { name: draft.name.trim(), company: draft.company.trim() || null, valueCents: Number.isFinite(cents) ? cents : null, pipelineId: pipeline?.id ?? null, stageId: stages[0]?.id ?? null });
    setAdding(false); setDraft({ name: "", company: "", value: "" });
  }

  // Deals in this pipeline that pass search + filters. Board and List both read this.
  const ownerOptions = useMemo(() => [...new Set(board.map(ownerLabel))].sort(), [board]);
  const sourceOptions = useMemo(() => [...new Set(board.map(sourceLabel))].sort(), [board]);
  const searchFields = useMemo(() => [
    { key: "stage", label: "Stage", options: stages.map((s) => s.name) },
    { key: "owner", label: "Owner", options: ownerOptions },
    { key: "source", label: "Source", options: sourceOptions },
  ], [stages, ownerOptions, sourceOptions]);
  const filtered = useMemo(() => {
    const { q, quick, fields } = search;
    const inPipeline = new Set(stages.map((s) => s.id));
    const thisMonth = new Date().toISOString().slice(0, 7);
    return board.filter((o) => {
      if (!o.stage_id || !inPipeline.has(o.stage_id)) return false;
      if (!textMatch(q, o.title, o.contact_name)) return false;
      if (quick.includes("mine") && o.owner_id !== meId) return false;
      if (quick.includes("unassigned") && o.owner_id) return false;
      if (quick.includes("has_value") && o.value_cents == null) return false;
      if (quick.includes("prob50") && (o.probability == null || o.probability < 50)) return false;
      if (quick.includes("closing_month") && (o.expected_close ?? "").slice(0, 7) !== thisMonth) return false;
      if (quick.includes("stalled") && !isStalled(o)) return false;
      if (fields.stage?.length && !fields.stage.includes(stageName.get(o.stage_id) ?? "")) return false;
      if (fields.owner?.length && !fields.owner.includes(ownerLabel(o))) return false;
      if (fields.source?.length && !fields.source.includes(sourceLabel(o))) return false;
      return true;
    });
  }, [board, stages, stageName, search, meId]);
  // List-view grouping (the Board is grouped by stage by nature).
  const listGroups = useMemo(() => {
    const g = search.groupBy || "none";
    if (g === "none") return null;
    const keyOf = (o: BoardOpp) => g === "stage" ? (stageName.get(o.stage_id ?? "") ?? "No stage")
      : g === "owner" ? ownerLabel(o)
      : g === "source" ? sourceLabel(o)
      : g === "close_month" ? ((o.expected_close ?? "").slice(0, 7) || "No close date")
      : o.created_at.slice(0, 7);
    const map = new Map<string, BoardOpp[]>();
    for (const o of filtered) { const k = keyOf(o); (map.get(k) ?? map.set(k, []).get(k)!).push(o); }
    return [...map.entries()].sort((a, b) => b[1].length - a[1].length);
  }, [filtered, search.groupBy, stageName]);

  // Selection lives on the filtered set; a filter change drops anything no longer visible.
  const filteredIds = useMemo(() => filtered.map((o) => o.id), [filtered]);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- prune selection when the visible set changes
  useEffect(() => { setSelected((s) => { const keep = new Set(filteredIds); const n = new Set([...s].filter((id) => keep.has(id))); return n.size === s.size ? s : n; }); }, [filteredIds]);
  const allSelected = filteredIds.length > 0 && filteredIds.every((id) => selected.has(id));
  function toggleRow(id: string) { setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; }); }
  async function bulk(body: Record<string, unknown>, verb: string) {
    const ids = [...selected]; if (!ids.length) return;
    setBusy(true); setActionResult(null);
    try {
      const r = await runBulk("/api/sales/opportunities/bulk", { ...body, ids });
      if (!r.ok) { setActionResult(r.error); return; }
      setActionResult(r.file ? `Exported ${ids.length.toLocaleString()} deal${ids.length === 1 ? "" : "s"} to ${r.file}.` : `${verb} ${r.count.toLocaleString()} deal${r.count === 1 ? "" : "s"}${r.failed ? ` — ${r.failed} failed` : ""}.`);
      if (!r.file) { setSelected(new Set()); await load(); }
    } finally { setBusy(false); }
  }
  const selectionActions: SelectionAction[] = [
    { key: "stage", icon: "ti-arrow-right", label: "Move to stage", options: stages.map((s) => ({ value: s.id, label: s.name })), runWith: (stageId) => void bulk({ op: "stage", stageId }, "Moved") },
    { key: "owner", icon: "ti-user", label: "Assign owner", options: [{ value: "", label: "Unassigned" }, ...staff.map((s) => ({ value: s.id, label: s.name }))], runWith: (ownerId) => void bulk({ op: "owner", ownerId: ownerId || null }, "Reassigned") },
    { key: "won", icon: "ti-check", label: "Mark sold", run: () => void bulk({ op: "status", status: "won" }, "Marked sold") },
    ...(canExport ? [{ key: "export", icon: "ti-download", label: "Export CSV", run: () => void bulk({ op: "export" }, "Exported") } as SelectionAction] : []),
    { key: "archive", icon: "ti-archive", label: "Archive", run: () => void bulk({ op: "status", status: "archived" }, "Archived") },
  ];

  const gearItems: GearItem[] = [
    ...(canExport ? [{ key: "export", icon: "ti-download", label: "Export all", hint: `${filtered.length.toLocaleString()} matching`, onClick: () => downloadCsv(`pipeline-${new Date().toISOString().slice(0, 10)}.csv`, ["Deal", "Contact", "Stage", "Owner", "Value", "Probability", "Expected close", "Source", "Created"], filtered.map((o) => [o.title, o.contact_name, stageName.get(o.stage_id ?? "") ?? "", ownerLabel(o), o.value_cents == null ? "" : (o.value_cents / 100).toFixed(2), o.probability ?? "", o.expected_close ?? "", sourceLabel(o), o.created_at.slice(0, 10)])) } as GearItem] : []),
    { key: "stages", icon: "ti-adjustments", label: "Edit stages", sep: canExport, onClick: () => setView("stages") },
    { key: "newp", icon: "ti-plus", label: "New pipeline", onClick: () => void newPipeline() },
    ...(pipeline ? [{ key: "rename", icon: "ti-pencil", label: "Rename pipeline", onClick: () => void renamePipeline() } as GearItem] : []),
  ];
  const segBtn = (on: boolean, first = false): React.CSSProperties => ({ fontSize: 12, padding: "6px 12px", border: "none", borderLeft: first ? "none" : "0.5px solid var(--border-strong, #cbd5e1)", background: on ? "#EFF6FF" : "#fff", color: on ? "#1A6CE4" : "var(--muted-foreground)", fontWeight: on ? 600 : 400, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 5 });
  const LIST_COLS = "30px 1.8fr 1.1fr 130px 1fr 90px 100px 80px";

  return (
    <div>
      {err && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, fontSize: 12.5, color: "#A32D2D", background: "#FCEBEB", border: "0.5px solid #F3C6C6", borderRadius: 8, padding: "8px 12px" }}>
          <i className="ti ti-alert-triangle" aria-hidden="true" />
          <span style={{ flex: 1 }}>{err}</span>
          <button type="button" aria-label="Dismiss" onClick={() => setErr(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "#A32D2D" }}><i className="ti ti-x" aria-hidden="true" /></button>
        </div>
      )}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
        <NewButton onClick={() => setAdding((v) => !v)} />
        <ToolbarGear items={gearItems} heading="Pipeline" />
        <select value={selId} onChange={(e) => setSelId(e.target.value)} style={{ fontSize: 12.5, fontWeight: 600, padding: "6px 10px", borderRadius: 8, border: "1px solid #2E78F5", background: "#EFF6FF", color: "#1A6CE4" }}>
          {pipelines.map((p) => <option key={p.id} value={p.id}>{p.name}{p.is_default ? " (default)" : ""}</option>)}
        </select>
        {view !== "stages" && (
          <OdooSearchBar scope="opportunities" state={search} onChange={setSearch} quick={PIPE_QUICK} fields={searchFields} groups={PIPE_GROUPS} noGroupId="none" placeholder={view === "board" ? "Search cards…" : "Search deals…"} width={480} />
        )}
        <div style={{ marginLeft: "auto", display: "inline-flex", border: "0.5px solid var(--border-strong, #cbd5e1)", borderRadius: 8, overflow: "hidden" }}>
          <button type="button" onClick={() => setView("board")} style={segBtn(view === "board", true)}><i className="ti ti-layout-kanban" aria-hidden="true" /> Board</button>
          <button type="button" onClick={() => setView("list")} style={segBtn(view === "list")}><i className="ti ti-list" aria-hidden="true" /> List</button>
          <button type="button" onClick={() => setView("stages")} style={segBtn(view === "stages")}>Edit stages</button>
        </div>
        <SalesViewControl />
      </div>

      {adding && (
        <div style={{ background: "#F5F9FF", border: "0.5px solid #BFDBFE", borderRadius: 10, padding: 12, marginBottom: 12, display: "grid", gridTemplateColumns: "1.4fr 1fr 0.7fr auto", gap: 8, alignItems: "center" }}>
          <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Contact name *" autoFocus style={{ fontSize: 12, padding: "7px 10px", borderRadius: 8, border: "0.5px solid var(--border)", background: "#fff" }} />
          <input value={draft.company} onChange={(e) => setDraft({ ...draft, company: e.target.value })} placeholder="Company" style={{ fontSize: 12, padding: "7px 10px", borderRadius: 8, border: "0.5px solid var(--border)", background: "#fff" }} />
          <input value={draft.value} onChange={(e) => setDraft({ ...draft, value: e.target.value })} placeholder="Value $" style={{ fontSize: 12, padding: "7px 10px", borderRadius: 8, border: "0.5px solid var(--border)", background: "#fff" }} />
          <div style={{ display: "flex", gap: 6 }}>
            <button type="button" onClick={() => void addDeal()} disabled={busy || !draft.name.trim()} style={{ fontSize: 12, fontWeight: 600, color: "#fff", background: "#0F6E56", border: "none", borderRadius: 7, padding: "7px 12px", cursor: "pointer", opacity: busy || !draft.name.trim() ? 0.5 : 1 }}>Create in {stages[0]?.name ?? "first stage"}</button>
            <button type="button" onClick={() => setAdding(false)} style={{ fontSize: 12, color: "var(--muted-foreground)", background: "none", border: "none", cursor: "pointer" }}><i className="ti ti-x" aria-hidden="true" /></button>
          </div>
        </div>
      )}

      {view === "list" ? (
        <div style={{ background: "#fff", border: "0.5px solid #e2e6ed", borderRadius: 12, overflow: "hidden" }}>
          <ActionResult text={actionResult} onClose={() => setActionResult(null)} />
          <SelectionBar count={selected.size} total={filteredIds.length} onSelectAll={() => setSelected(new Set(filteredIds))} onClear={() => setSelected(new Set())} actions={selectionActions} busy={busy} heading="Selected deals" />
          <div style={{ display: "grid", gridTemplateColumns: LIST_COLS, padding: "8px 14px", background: "var(--muted)", fontSize: 10.5, fontWeight: 500, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center" }}><input type="checkbox" checked={allSelected} onChange={() => setSelected(allSelected ? new Set() : new Set(filteredIds))} aria-label="Select all" style={{ width: 14, height: 14, cursor: "pointer" }} /></div>
            <div>Deal</div><div>Contact</div><div>Stage</div><div>Owner</div><div>Value</div><div>Expected close</div><div>Prob.</div>
          </div>
          {filtered.length === 0 && <p style={{ padding: 24, textAlign: "center", fontSize: 12.5, color: "var(--muted-foreground)" }}>{stages.length === 0 ? "No stages. Add some in “Edit stages”." : "No deals match."}</p>}
          {(listGroups ?? [["", filtered] as [string, BoardOpp[]]]).map(([gk, list]) => (<Fragment key={gk || "_all"}>
          {gk && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 14px", background: "var(--muted)", borderTop: "0.5px solid #eef1f5", fontSize: 11.5, fontWeight: 600 }}>
              {gk} <span style={{ color: "var(--muted-foreground)", fontWeight: 400 }}>{list.length}{list.some((o) => o.value_cents) ? ` · ${money(list.reduce((a, o) => a + (o.value_cents ?? 0), 0))}` : ""}</span>
            </div>
          )}
          {list.map((o) => (
            <div key={o.id} style={{ display: "grid", gridTemplateColumns: LIST_COLS, padding: "10px 14px", borderTop: "0.5px solid #eef1f5", alignItems: "center", fontSize: 12.5, background: selected.has(o.id) ? "#F5F9FF" : undefined }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
                <input type="checkbox" checked={selected.has(o.id)} onChange={() => toggleRow(o.id)} aria-label={`Select ${o.title}`} style={{ width: 14, height: 14, cursor: "pointer" }} />
              </div>
              <div style={{ minWidth: 0 }}>
                <Link href={`/admin/sales/opportunities/${o.id}`} style={{ fontWeight: 500, color: "var(--foreground)", textDecoration: "none", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", display: "block" }}>{o.title}</Link>
                {isStalled(o) && <span style={{ fontSize: 10, color: "#A32D2D" }}><i className="ti ti-clock" aria-hidden="true" /> stalled</span>}
              </div>
              <div style={{ color: "var(--muted-foreground)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{o.contact_name ?? "—"}</div>
              <div>
                <select value={o.stage_id ?? ""} onChange={(e) => moveOpp(o.id, e.target.value)} disabled={busy} style={{ fontSize: 11.5, padding: "4px 6px", borderRadius: 6, border: "0.5px solid var(--border)", background: "var(--background)", color: "var(--foreground)", maxWidth: 120 }}>
                  {stages.map((st) => <option key={st.id} value={st.id}>{st.name}</option>)}
                </select>
              </div>
              <div style={{ color: "var(--muted-foreground)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{ownerLabel(o)}</div>
              <div style={{ color: "#185FA5" }}>{o.value_cents != null ? money(o.value_cents) : "—"}</div>
              <div style={{ color: "var(--muted-foreground)", fontSize: 11.5 }}>{o.expected_close ? o.expected_close.slice(0, 10) : "—"}</div>
              <div style={{ color: "#3B6D11" }}>{o.probability != null ? `${o.probability}%` : "—"}</div>
            </div>
          ))}
          </Fragment>))}
          {filtered.length > 0 && (
            <div style={{ padding: "8px 14px", borderTop: "0.5px solid #eef1f5", fontSize: 11, color: "var(--muted-foreground)" }}>
              {filtered.length.toLocaleString()} deal{filtered.length === 1 ? "" : "s"} · {money(filtered.reduce((a, o) => a + (o.value_cents ?? 0), 0)) || "$0"} · {stageName.size} stages
            </div>
          )}
        </div>
      ) : view === "board" ? (
        <HScrollBoard>
          {stages.map((s, si) => {
            const cards = filtered.filter((o) => o.stage_id === s.id);
            const total = cards.reduce((a, o) => a + (o.value_cents ?? 0), 0);
            const accent = s.is_won ? "#0F6E56" : STAGE_ACCENTS[si % STAGE_ACCENTS.length];
            return (
              <div key={s.id} style={{ minWidth: 280, flex: "0 0 280px", background: "var(--muted)", borderRadius: 12, padding: 10 }}>
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
                          : o.priority > 0 ? <span style={{ fontSize: 11, color: "#EF9F27" }}>{Array.from({ length: o.priority }).map((_, i) => <i key={i} className="ti ti-star-filled" aria-hidden="true" />)}</span>
                          : <span />}
                        {o.probability != null && <span style={{ fontSize: 10, color: "#3B6D11" }}>{o.probability}%</span>}
                      </div>
                      <div style={{ display: "flex", gap: 6, marginTop: 7, alignItems: "center" }}>
                        <Link href={`/admin/sales/opportunities/${o.id}`} style={{ fontSize: 10, color: "#185FA5", border: "0.5px solid var(--border-strong, #cbd5e1)", borderRadius: 6, padding: "3px 8px", textDecoration: "none", whiteSpace: "nowrap" }}><i className="ti ti-external-link" aria-hidden="true" /> Open</Link>
                        <select value={s.id} onChange={(e) => moveOpp(o.id, e.target.value)} disabled={busy} style={{ flex: 1, minWidth: 0, fontSize: 10.5, padding: "3px 5px", borderRadius: 6, border: "0.5px solid var(--border)", background: "var(--background)", color: "var(--muted-foreground)" }}>
                          {stages.map((st) => <option key={st.id} value={st.id}>Move → {st.name}</option>)}
                        </select>
                      </div>
                    </div>
                  ))}
                  {cards.length === 0 && <div style={{ fontSize: 11, color: "var(--muted-foreground)", textAlign: "center", padding: "10px 0" }}>—</div>}
                </div>
              </div>
            );
          })}
          {stages.length === 0 && <p style={{ fontSize: 12.5, color: "var(--muted-foreground)" }}>No stages. Add some in “Edit stages”.</p>}
        </HScrollBoard>
      ) : (
        <div style={{ background: "#fff", border: "0.5px solid #e2e6ed", borderRadius: 12, overflow: "hidden", maxWidth: 620 }}>
          <div style={{ padding: "10px 14px", borderBottom: "0.5px solid #e2e6ed", display: "flex", alignItems: "center" }}>
            <span style={{ fontSize: 12.5, fontWeight: 600 }}>Stages · {pipeline?.name}</span>
            <button onClick={addStage} style={{ marginLeft: "auto", fontSize: 11.5, fontWeight: 600, color: "#fff", background: "#2E78F5", border: "none", borderRadius: 6, padding: "5px 11px", cursor: "pointer" }}>+ Add stage</button>
          </div>
          {stages.map((s, i) => {
            const wonCount = stages.filter((x) => x.is_won).length;
            const reason = stages.length <= 1 ? "A pipeline needs at least one stage" : (s.is_won && wonCount <= 1 ? "Keep at least one Won stage" : null);
            return (
            <div key={s.id} style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 8, rowGap: 8, padding: "10px 14px", borderTop: "0.5px solid #eef1f5", fontSize: 12.5 }}>
              <span style={{ fontSize: 11, color: "var(--muted-foreground)", width: 18, flexShrink: 0 }}>{i + 1}</span>
              <span style={{ flex: "1 1 120px", minWidth: 0, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={s.name}>{s.name}</span>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginLeft: "auto", flexShrink: 0 }}>
                <select
                  value={s.sequence_id ?? ""}
                  onChange={(e) => call(`/api/sales/stages/${s.id}`, "PATCH", { sequenceId: e.target.value || null })}
                  disabled={busy}
                  title="Auto-enroll a deal's contact into this sequence when it enters this stage"
                  style={{ fontSize: 11, border: "0.5px solid var(--border)", borderRadius: 6, padding: "3px 6px", maxWidth: 150, color: s.sequence_id ? "#1A6CE4" : "var(--muted-foreground)", background: "#fff", cursor: "pointer" }}
                >
                  <option value="">No sequence</option>
                  {sequences.map((sq) => <option key={sq.id} value={sq.id}>{sq.name}</option>)}
                </select>
                <button type="button" onClick={() => call(`/api/sales/stages/${s.id}`, "PATCH", { isWon: !s.is_won })} disabled={busy} style={{ fontSize: 10.5, fontWeight: 600, color: s.is_won ? "#0F6E56" : "var(--muted-foreground)", background: s.is_won ? "#E1F5EE" : "#fff", border: "0.5px solid var(--border)", borderRadius: 6, padding: "3px 8px", cursor: "pointer" }}>Won stage</button>
                <button type="button" aria-label="Move up" onClick={() => moveStage(s, -1)} disabled={busy || i === 0} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted-foreground)", opacity: i === 0 ? 0.3 : 1 }}>↑</button>
                <button type="button" aria-label="Move down" onClick={() => moveStage(s, 1)} disabled={busy || i === stages.length - 1} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted-foreground)", opacity: i === stages.length - 1 ? 0.3 : 1 }}>↓</button>
                <button type="button" aria-label="Rename stage" title="Rename stage" onClick={() => renameStage(s)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted-foreground)", fontSize: 13 }}><i className="ti ti-pencil" aria-hidden="true" /></button>
                <button type="button" aria-label="Delete stage" onClick={() => { setDelErr(null); setReassignTo(""); setDelTarget(s); }} disabled={busy || reason !== null} title={reason ?? "Delete stage"} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 26, height: 26, background: reason ? "none" : "#FCEBEB", border: reason ? "none" : "0.5px solid #F3C6C6", borderRadius: 6, cursor: reason ? "not-allowed" : "pointer", color: "#A32D2D", fontSize: 13, opacity: reason ? 0.3 : 1 }}><i className="ti ti-trash" aria-hidden="true" /></button>
              </div>
            </div>
            );
          })}
        </div>
      )}

      {delTarget && (
        <div onClick={() => { if (!delBusy) setDelTarget(null); }} style={{ position: "fixed", inset: 0, background: "rgba(10,20,40,0.35)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", borderRadius: 12, width: 430, maxWidth: "92vw", padding: "18px 20px", boxShadow: "0 20px 60px rgba(0,0,0,0.25)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <i className="ti ti-trash" aria-hidden="true" style={{ color: "#A32D2D", fontSize: 16 }} />
              <span style={{ fontSize: 14, fontWeight: 600 }}>Delete stage “{delTarget.name}”?</span>
            </div>
            <p style={{ fontSize: 12.5, color: "var(--muted-foreground)", margin: "0 0 12px", lineHeight: 1.5 }}>Choose where its opportunities go. They aren’t deleted.</p>
            <label style={{ fontSize: 11, color: "var(--muted-foreground)" }}>Move deals to</label>
            <select value={reassignTo} onChange={(e) => setReassignTo(e.target.value)} disabled={delBusy} style={{ width: "100%", marginTop: 4, fontSize: 12.5, padding: "7px 9px", borderRadius: 8, border: "0.5px solid var(--border)", background: "#fff", color: "var(--foreground)" }}>
              <option value="">Leave unstaged (drop off the board)</option>
              {stages.filter((x) => x.id !== delTarget.id).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
            </select>
            {delErr && <p style={{ fontSize: 12, color: "#A32D2D", margin: "10px 0 0" }}>{delErr}</p>}
            <div style={{ display: "flex", gap: 8, marginTop: 16, justifyContent: "flex-end" }}>
              <button onClick={() => setDelTarget(null)} disabled={delBusy} style={{ fontSize: 12, padding: "7px 14px", border: "0.5px solid var(--border-strong, #cbd5e1)", borderRadius: 8, background: "#fff", color: "var(--foreground)", cursor: "pointer" }}>Cancel</button>
              <button onClick={confirmDeleteStage} disabled={delBusy} style={{ fontSize: 12, fontWeight: 600, padding: "7px 14px", border: "none", borderRadius: 8, background: "#A32D2D", color: "#fff", cursor: "pointer", opacity: delBusy ? 0.6 : 1 }}>{delBusy ? "Deleting…" : "Delete stage"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
