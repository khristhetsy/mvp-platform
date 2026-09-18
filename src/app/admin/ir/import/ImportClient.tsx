"use client";

/**
 * Odoo import wizard — five steps, Odoo read-only throughout.
 *   1 Export from Odoo   read projects live; pick the founder's monthly projects
 *   2 Map projects       each Odoo project → Month N of one IR project (new or existing); name drift shown
 *   3 Match investors    Odoo tags → Investor Contacts (email, then name + firm); ambiguous / missing wait here
 *   4 Review activities  Agent Field → dated activities + stage per investor; unreadable dates block approval
 *   5 Import             write the approved plan, then reconcile counts against Odoo
 */
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { Candidate, Discovery, OdooTaskLite, TagResolution } from "@/lib/ir/odoo-import";
import type { ReconcileResult, ReconcileRow } from "@/lib/ir/odoo-reconcile";
import type { ParsedEntry, ProjectGroup } from "@/lib/ir/odoo-parse";
import { IR_ACTIVITY_LABEL, IR_ACTIVITY_TYPES, IR_STAGE_LABEL, type IrActivityType, type IrStage } from "@/lib/ir/types";

type Setup = { configured: boolean; discovery: Discovery; groups: ProjectGroup[]; imported: Record<string, string>; projects: Array<{ id: string; title: string; founder_name: string | null; status: string; start_date: string; term_months: number }>; staff: Array<{ id: string; name: string }> };
type Entry = ParsedEntry & { investorKey: string | null };
type TaskRow = OdooTaskLite & { assigneeId: string | null; entries: Entry[]; stages: Record<string, IrStage> };
type Loaded = { agentField: string | null; investorField: string; tasks: TaskRow[]; resolutions: TagResolution[] };
type FounderLink = { kind: "contact" | "company"; id: string; label: string; sub: string | null };
type Edit = { type: IrActivityType; subject: string; outcome: string; date: string; investorKey: string | null; approved: boolean };

const inp = "rounded-lg border border-slate-200 px-2.5 py-1.5 text-[12.5px] focus:border-indigo-400 focus:outline-none";
const pill = (k: "ok" | "warn" | "bad") => `rounded-full px-2 py-0.5 text-[11px] ${k === "ok" ? "bg-emerald-50 text-emerald-700" : k === "warn" ? "bg-amber-50 text-amber-800" : "bg-rose-50 text-rose-700"}`;
const STEPS = ["Export from Odoo", "Map projects", "Match investors", "Review activities", "Import"];

export function ImportClient({ meId }: { meId: string }) {
  const [mode, setMode] = useState<"import" | "reconcile" | "backup">("import");
  const [setup, setSetup] = useState<Setup | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState(1);
  const [groupKey, setGroupKey] = useState<string>("");
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [agentField, setAgentField] = useState<string>("");
  const [investorField, setInvestorField] = useState<string>("tag_ids");
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [busy, setBusy] = useState(false);
  // Step 2
  const [target, setTarget] = useState<"new" | string>("new");
  const [title, setTitle] = useState(""); const [founder, setFounder] = useState(""); const [owner, setOwner] = useState(meId); const [start, setStart] = useState(""); const [term, setTerm] = useState(6);
  const [monthOf, setMonthOf] = useState<Record<number, number>>({});
  const [founderLink, setFounderLink] = useState<FounderLink | null>(null);
  // Step 3
  const [chosen, setChosen] = useState<Record<string, Candidate | null>>({});
  const [searchFor, setSearchFor] = useState<string | null>(null);
  // Step 4
  const [edits, setEdits] = useState<Record<number, Edit[]>>({});
  const [taskAssignee, setTaskAssignee] = useState<Record<number, string | null>>({});
  const [result, setResult] = useState<{ projectId: string; created: boolean; tasksCreated: number; tasksSkipped: number; matchesCreated: number; matchesReused: number; activitiesCreated: number; stagesSet: number; warnings: string[] } | null>(null);

  function applyGroup(s: Setup, key: string) {
    const g = s.groups.find((x) => x.key === key); setGroupKey(key);
    if (!g) return;
    setPicked(new Set(g.projects.filter((p) => !s.imported[String(p.id)]).map((p) => p.id)));
    setTitle(g.founder); setFounder(g.founder);
    setMonthOf(Object.fromEntries(g.projects.map((p, i) => [p.id, p.month ?? i + 1])));
    setTerm(Math.max(4, Math.min(12, g.months)));
    const firstStart = g.projects.map((p) => p.dateStart).filter(Boolean).sort()[0];
    setStart(firstStart ?? "");
  }
  useEffect(() => {
    let live = true;
    fetch("/api/admin/ir/import").then((r) => r.json()).then((j) => { if (!live) return; if (j.error) { setError(j.error); return; } setSetup(j); setAgentField(j.discovery?.agentField ?? ""); setInvestorField(j.discovery?.investorField ?? "tag_ids"); if (j.groups?.[0]) applyGroup(j, j.groups[0].key); });
    return () => { live = false; };
  }, []);

  const group = useMemo(() => setup?.groups.find((g) => g.key === groupKey) ?? null, [setup, groupKey]);

  async function loadTasks() {
    setBusy(true); setError(null);
    const r = await fetch("/api/admin/ir/import", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "tasks", projectIds: [...picked], agentField: agentField || null, investorField }) });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) { setError(j.error ?? "Couldn't read tasks from Odoo."); return; }
    const L = j as Loaded;
    setLoaded(L);
    setChosen(Object.fromEntries(L.resolutions.map((x) => [x.tag, x.status === "matched" ? x.candidates[0] : null])));
    setEdits(Object.fromEntries(L.tasks.map((t) => [t.id, t.entries.map((e) => ({ type: e.type, subject: e.subject, outcome: e.outcome, date: e.date ?? "", investorKey: e.investorKey, approved: false }))])));
    setTaskAssignee(Object.fromEntries(L.tasks.map((t) => [t.id, t.assigneeId])));
    if (!start) { const earliest = L.tasks.flatMap((t) => t.entries.map((e) => e.date ?? "")).filter(Boolean).sort()[0] ?? L.tasks.map((t) => t.createDate.slice(0, 10)).sort()[0]; if (earliest) setStart(earliest); }
    setStep(2);
  }

  const tasks = useMemo(() => (loaded?.tasks ?? []).filter((t) => !t.alreadyImported), [loaded]);
  const tagsInUse = useMemo(() => [...new Set(tasks.flatMap((t) => t.tags.map((g) => g.name)))], [tasks]);
  const unresolved = tagsInUse.filter((t) => !chosen[t]);
  const badDates = tasks.reduce((n, t) => n + (edits[t.id] ?? []).filter((e) => !e.approved && !/^\d{4}-\d{2}-\d{2}$/.test(e.date)).length, 0);
  const unattributed = tasks.reduce((n, t) => n + (edits[t.id] ?? []).filter((e) => !e.investorKey).length, 0);
  const notApproved = tasks.filter((t) => (edits[t.id] ?? []).some((e) => !e.approved)).length;

  function approveTask(id: number, ok: boolean) { setEdits((s) => ({ ...s, [id]: (s[id] ?? []).map((e) => ({ ...e, approved: ok })) })); }
  function stageFor(t: TaskRow, tag: string): IrStage { return t.stages[tag] ?? "matched"; }

  async function runImport() {
    if (!tasks.length) { setError("Nothing to import — every selected task is already in the IR Hub."); return; }
    if (badDates) { setError(`${badDates} activit${badDates === 1 ? "y has" : "ies have"} an unreadable date (step 4).`); return; }
    if (target === "new" && (!title.trim() || !start)) { setError("Give the new project a title and a start date (step 2)."); return; }
    if (target === "new" && !founderLink) { setError("Link the founder to a Sales Hub contact or a company (step 2) — a project needs one."); return; }
    setBusy(true); setError(null);
    const plan = {
      target: target === "new" ? { create: { title: title.trim(), founderName: founder.trim() || null, ownerId: owner, startDate: start, termMonths: term, founderContactId: founderLink?.kind === "contact" ? founderLink.id : null, companyId: founderLink?.kind === "company" ? founderLink.id : null } } : { projectId: target },
      odooProjectIds: [...picked],
      tasks: tasks.map((t) => ({
        odooId: t.id, title: t.name, month: monthOf[t.projectId] ?? t.month ?? 1, week: t.week, assigneeId: taskAssignee[t.id] ?? null,
        investors: t.tags.map((g) => { const c = chosen[g.name]; if (!c) return null; const acts = (edits[t.id] ?? []).filter((e) => e.investorKey === g.name && e.approved); return { tag: g.name, contactId: c.id, stage: acts.length ? stageFor(t, g.name) : "matched" as IrStage, activities: acts.map((e) => ({ type: e.type, subject: e.subject, outcome: e.outcome, date: e.date, assigneeId: taskAssignee[t.id] ?? null })) }; }).filter((x): x is NonNullable<typeof x> => Boolean(x)),
      })),
    };
    const r = await fetch("/api/admin/ir/import", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "execute", plan }) });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) { setError(j.error ?? "Import failed."); return; }
    setResult(j); setStep(5);
  }

  if (error && !setup) return <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[12.5px] text-rose-700">{error}</div>;
  if (!setup) return <p className="text-[13px] text-slate-400">Reading from Odoo…</p>;
  if (!setup.configured) return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-[13px] text-amber-900">
      <p className="font-semibold">Odoo isn&rsquo;t connected on this environment.</p>
      <p className="mt-1">The import reads Deals2Match live through the Odoo API. Set <code>ODOO_URL</code>, <code>ODOO_DB</code>, <code>ODOO_USERNAME</code> and <code>ODOO_API_KEY</code> on the deployment (the same variables the Sales Hub Odoo sync uses), redeploy, and reopen this page.</p>
    </div>
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><h2 className="text-[20px] font-semibold text-slate-900">Import deal flow from Odoo</h2><p className="text-[12.5px] text-slate-500">{setup.groups.reduce((n, g) => n + g.projects.length, 0)} projects across {setup.groups.length} founders found. Import one founder at a time.</p></div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg bg-slate-100 p-0.5" role="group" aria-label="Mode">{(["import", "reconcile", "backup"] as const).map((m) => <button key={m} type="button" onClick={() => setMode(m)} className={`rounded-md px-2.5 py-1 text-[12px] font-medium ${mode === m ? "bg-white text-indigo-700 shadow-sm ring-1 ring-slate-200" : "text-slate-600 hover:text-slate-900"}`}>{m === "import" ? "Import" : m === "reconcile" ? "Reconcile" : "Backup"}</button>)}</div>
          <span className="rounded-full bg-amber-50 px-3 py-1 text-[12px] text-amber-800">Odoo is read only until cutover</span>
        </div>
      </div>
      {mode === "reconcile" ? <ReconcilePanel /> : null}
      {mode === "backup" ? <BackupPanel /> : null}
      {mode !== "import" ? null : <>
      <ol className="flex flex-wrap gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-[12.5px]">
        {STEPS.map((s, i) => { const n = i + 1; const state = n < step ? "done" : n === step ? "now" : "todo"; return <li key={s} className={`flex items-center gap-2 ${state === "todo" ? "text-slate-400" : "text-slate-900"}`}><span className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-semibold ${state === "done" ? "bg-emerald-600 text-white" : state === "now" ? "bg-indigo-600 text-white" : "bg-slate-200 text-slate-600"}`}>{n}</span>{s}</li>; })}
      </ol>
      {error ? <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[12.5px] text-rose-700">{error}</div> : null}

      {step === 1 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="mb-3 flex flex-wrap items-center gap-3">
            <label className="text-[12.5px] text-slate-600">Founder <select value={groupKey} onChange={(e) => applyGroup(setup, e.target.value)} className={`ml-2 ${inp}`}>{setup.groups.map((g) => <option key={g.key} value={g.key}>{g.founder} · {g.projects.length} project{g.projects.length === 1 ? "" : "s"}</option>)}</select></label>
            <label className="text-[12.5px] text-slate-600">Investors on task <select value={investorField} onChange={(e) => setInvestorField(e.target.value)} className={`ml-2 ${inp}`}><option value="tag_ids">Tags (tag_ids)</option>{setup.discovery.hasPartner ? <option value="partner_id">Customer (partner_id)</option> : null}{setup.discovery.customFields.filter((f) => ["many2many", "one2many", "many2one"].includes(f.type) && f.relation).map((f) => <option key={f.name} value={f.name}>{f.label} ({f.name} → {f.relation})</option>)}</select></label>
            <label className="text-[12.5px] text-slate-600">Agent Field <select value={agentField} onChange={(e) => setAgentField(e.target.value)} className={`ml-2 ${inp}`}><option value="">— none —</option><option value="description">Description (description)</option>{setup.discovery.customFields.filter((f) => ["text", "html", "char"].includes(f.type)).map((f) => <option key={f.name} value={f.name}>{f.label} ({f.name})</option>)}</select></label>
          </div>
          <p className="mb-3 text-[11.5px] text-slate-400">Investors on task is where each Odoo task names its investors — Odoo tags, the task&rsquo;s Customer, or a Studio contact field. Agent Field is the text the agent logged activities in; pick Description if your team wrote them there.</p>
          {group ? (
            <table className="w-full text-[12.5px]">
              <thead><tr className="text-left text-[11px] text-slate-500"><th className="w-8 py-1.5"></th><th className="py-1.5 font-medium">Odoo project</th><th className="py-1.5 font-medium">Tasks</th><th className="py-1.5 font-medium">Maps to</th><th className="py-1.5 font-medium">Owner</th><th className="py-1.5 font-medium"></th></tr></thead>
              <tbody className="divide-y divide-slate-100">{group.projects.map((p) => { const done = setup.imported[String(p.id)]; return <tr key={p.id} className={done ? "text-slate-400" : ""}>
                <td className="py-1.5"><input type="checkbox" disabled={Boolean(done)} checked={picked.has(p.id)} onChange={(e) => setPicked((s) => { const n = new Set(s); if (e.target.checked) n.add(p.id); else n.delete(p.id); return n; })} aria-label={`Select ${p.name}`} /></td>
                <td className="py-1.5">{p.name}</td><td className="py-1.5">{p.taskCount || "—"}</td><td className="py-1.5">Month {p.month ?? "?"}</td><td className="py-1.5">{p.userName ?? "—"}</td>
                <td className="py-1.5">{done ? <Link href={`/admin/ir/projects/${done}`} className={pill("ok")}>Imported</Link> : p.nameFixed ? <span className={pill("warn")}>Name fixed</span> : p.month == null ? <span className={pill("warn")}>No month in name</span> : <span className={pill("ok")}>Ready</span>}</td>
              </tr>; })}</tbody>
            </table>
          ) : <p className="text-[12.5px] text-slate-400">No Odoo projects found.</p>}
          <div className="mt-4 flex justify-end"><button type="button" disabled={busy || !picked.size} onClick={loadTasks} className="rounded-lg bg-indigo-600 px-4 py-1.5 text-[12.5px] font-semibold text-white hover:bg-indigo-700 disabled:opacity-60">{busy ? "Reading tasks…" : `Read ${picked.size} project${picked.size === 1 ? "" : "s"} from Odoo`}</button></div>
        </div>
      ) : null}

      {step === 2 && loaded ? (
        <div className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <h3 className="mb-2 text-[15px] font-semibold text-slate-900">IR project</h3>
            <label className="mb-2 block text-[12px] text-slate-600">Target<select value={target} onChange={(e) => setTarget(e.target.value)} className={`mt-1 w-full ${inp}`}><option value="new">Create a new project</option>{setup.projects.map((p) => <option key={p.id} value={p.id}>{p.title}{p.founder_name ? ` · ${p.founder_name}` : ""} ({p.status})</option>)}</select></label>
            {target === "new" ? (
              <div className="grid gap-2 text-[12px] text-slate-600">
                <label>Title<input value={title} onChange={(e) => setTitle(e.target.value)} className={`mt-1 w-full ${inp}`} /></label>
                <label>Founder<input value={founder} onChange={(e) => setFounder(e.target.value)} className={`mt-1 w-full ${inp}`} /></label>
                <FounderPicker seed={founder} value={founderLink} onChange={setFounderLink} />
                <label>Owner<select value={owner} onChange={(e) => setOwner(e.target.value)} className={`mt-1 w-full ${inp}`}>{setup.staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
                <div className="grid grid-cols-2 gap-2"><label>Start date<input type="date" value={start} onChange={(e) => setStart(e.target.value)} className={`mt-1 w-full ${inp}`} /></label><label>Term (months)<input type="number" min={1} max={12} value={term} onChange={(e) => setTerm(Number(e.target.value))} className={`mt-1 w-full ${inp}`} /></label></div>
                <p className="text-[11.5px] text-slate-400">Start date defaults to the earliest Agent Field entry. Months are 28 days with four 7-day weeks; Odoo tasks land in the week named in their title, else the first week of their month.</p>
              </div>
            ) : <p className="text-[12px] text-slate-500">Tasks and matches are added to the existing project; investors already on it are reused and only gain the new activities.</p>}
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <h3 className="mb-2 text-[15px] font-semibold text-slate-900">Project mapping</h3>
            <table className="w-full text-[12.5px]"><thead><tr className="text-left text-[11px] text-slate-500"><th className="py-1.5 font-medium">Odoo project</th><th className="py-1.5 font-medium">Tasks</th><th className="py-1.5 font-medium">Maps to</th><th className="py-1.5"></th></tr></thead>
              <tbody className="divide-y divide-slate-100">{(group?.projects ?? []).filter((p) => picked.has(p.id)).map((p) => <tr key={p.id}><td className="py-1.5">{p.name}</td><td className="py-1.5">{loaded.tasks.filter((t) => t.projectId === p.id).length}</td>
                <td className="py-1.5"><select value={monthOf[p.id] ?? 1} onChange={(e) => setMonthOf((s) => ({ ...s, [p.id]: Number(e.target.value) }))} className={inp}>{Array.from({ length: term }, (_, i) => i + 1).map((m) => <option key={m} value={m}>Month {m}</option>)}</select></td>
                <td className="py-1.5">{p.nameFixed ? <span className={pill("warn")}>Name fixed → {group?.founder}</span> : <span className={pill("ok")}>Ready</span>}</td></tr>)}</tbody></table>
            <p className="mt-2 text-[11.5px] text-slate-400">{loaded.tasks.filter((t) => t.alreadyImported).length ? `${loaded.tasks.filter((t) => t.alreadyImported).length} task(s) already imported will be skipped.` : ""}</p>
          </div>
          <Nav onBack={() => setStep(1)} onNext={() => setStep(3)} />
        </div>
      ) : null}

      {step === 3 && loaded ? (
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="mb-2 flex items-baseline justify-between"><h3 className="text-[15px] font-semibold text-slate-900">Investor tags → Investor Contacts</h3><span className="text-[12px] text-slate-500">{tagsInUse.length - unresolved.length} of {tagsInUse.length} resolved · contacts are never created here · unresolved tags are skipped, not blocking</span></div>
          <table className="w-full text-[12.5px]"><thead><tr className="text-left text-[11px] text-slate-500"><th className="py-1.5 font-medium">Odoo tag</th><th className="py-1.5 font-medium">Investor Contact</th><th className="py-1.5 font-medium">Matched by</th><th className="py-1.5"></th></tr></thead>
            <tbody className="divide-y divide-slate-100">{loaded.resolutions.filter((x) => tagsInUse.includes(x.tag)).map((x) => { const c = chosen[x.tag]; return <tr key={x.tag}>
              <td className="py-1.5 text-slate-800">{x.tag}</td>
              <td className="py-1.5">{c ? <span className="text-slate-900">{c.name ?? "—"}{c.firm ? <span className="text-slate-500"> · {c.firm}</span> : null}</span> : x.status === "ambiguous" ? <span className="text-amber-800">{x.candidates.length} possible contacts</span> : <span className="text-rose-700">No contact found</span>}</td>
              <td className="py-1.5 text-slate-600">{c ? (c.id === x.candidates[0]?.id && x.status === "matched" ? x.by : "Chosen") : ""}</td>
              <td className="py-1.5 text-right">{c ? <button type="button" onClick={() => setChosen((s) => ({ ...s, [x.tag]: null }))} className="text-[12px] text-slate-500 hover:text-slate-800">Change</button> : x.status === "ambiguous" ? <select defaultValue="" onChange={(e) => { const cand = x.candidates.find((k) => k.id === e.target.value); if (cand) setChosen((s) => ({ ...s, [x.tag]: cand })); }} className={inp}><option value="">Choose…</option>{x.candidates.map((k) => <option key={k.id} value={k.id}>{k.name ?? "—"}{k.firm ? ` · ${k.firm}` : ""}</option>)}</select> : <button type="button" onClick={() => setSearchFor(x.tag)} className="rounded-md border border-slate-200 px-2 py-1 text-[12px] text-slate-700 hover:bg-slate-50">Search</button>}</td>
            </tr>; })}</tbody></table>
          {searchFor ? <SearchDialog tag={searchFor} onPick={(c) => { setChosen((s) => ({ ...s, [searchFor]: c })); setSearchFor(null); }} onClose={() => setSearchFor(null)} /> : null}
          <p className="mt-2 text-[11.5px] text-slate-400">Tags with no contact are skipped on import (nothing is created for them). Add the investor in Sales Hub and run the import again to pick them up.</p>
          <Nav onBack={() => setStep(2)} onNext={() => setStep(4)} />
        </div>
      ) : null}

      {step === 4 && loaded ? (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-[12.5px]">
            <span className="font-semibold text-slate-900">Agent Field → activities</span><span className="text-slate-500">AI-free parse · staff approve per task</span>
            <span className="ml-auto flex gap-2">{badDates ? <span className={pill("bad")}>{badDates} unreadable date{badDates === 1 ? "" : "s"}</span> : null}{unattributed ? <span className={pill("warn")}>{unattributed} not attributed (will be skipped)</span> : null}<span className={pill(notApproved ? "warn" : "ok")}>{tasks.length - notApproved} of {tasks.length} tasks approved</span></span>
            <button type="button" onClick={() => tasks.forEach((t) => approveTask(t.id, true))} disabled={badDates > 0} className="rounded-md border border-slate-200 px-2.5 py-1 text-[12px] text-slate-700 hover:bg-slate-50 disabled:opacity-50">Approve all</button>
          </div>
          {tasks.map((t) => { const rows = edits[t.id] ?? []; const allOk = rows.length > 0 && rows.every((e) => e.approved); return (
            <div key={t.id} className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className="text-[13.5px] font-semibold text-slate-900">{t.name}</span><span className="text-[12px] text-slate-500">{t.projectName} · Month {monthOf[t.projectId] ?? t.month ?? "?"}{t.week ? ` · Week ${t.week}` : ""}</span>
                <label className="ml-auto text-[12px] text-slate-600">Agent <select value={taskAssignee[t.id] ?? ""} onChange={(e) => setTaskAssignee((s) => ({ ...s, [t.id]: e.target.value || null }))} className={`ml-1 ${inp}`}><option value="">— {t.assignee ?? "unassigned"} —</option>{setup.staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
                <button type="button" onClick={() => approveTask(t.id, !allOk)} disabled={rows.some((e) => !/^\d{4}-\d{2}-\d{2}$/.test(e.date))} className={`rounded-md px-2.5 py-1 text-[12px] font-medium ${allOk ? "bg-emerald-50 text-emerald-700" : "bg-indigo-600 text-white hover:bg-indigo-700"} disabled:opacity-50`}>{allOk ? "Approved" : "Approve"}</button>
              </div>
              <div className="mb-2 flex flex-wrap gap-1">{t.tags.map((g) => { const c = chosen[g.name]; return <span key={g.id} className={`rounded px-1.5 py-0.5 text-[11px] ${c ? "bg-blue-50 text-blue-800" : "bg-rose-50 text-rose-700"}`}>{g.name}{c ? ` → ${IR_STAGE_LABEL[stageFor(t, g.name)]}` : " · unmatched"}</span>; })}{t.tags.length === 0 ? <span className="text-[11.5px] text-slate-400">No investors found in the “{loaded.investorField}” field — change “Investors on task” in step 1 if they live elsewhere.</span> : null}</div>
              {t.agentText ? <pre className="mb-2 whitespace-pre-wrap rounded-md bg-slate-50 px-3 py-2 font-mono text-[11.5px] text-slate-700">{t.agentText}</pre> : <p className="mb-2 text-[12px] text-slate-400">No text in the Agent Field{loaded.agentField ? ` (${loaded.agentField})` : ""} — pick Description or the right field in step 1, or the task imports with its investors in Matched and no activities.</p>}
              {rows.length ? <table className="w-full text-[12px]"><thead><tr className="text-left text-[11px] text-slate-500"><th className="py-1 font-medium">Investor</th><th className="py-1 font-medium">Type</th><th className="py-1 font-medium">Outcome</th><th className="py-1 font-medium">Date</th><th className="py-1"></th></tr></thead>
                <tbody className="divide-y divide-slate-100">{rows.map((e, i) => { const set = (patch: Partial<Edit>) => setEdits((s) => ({ ...s, [t.id]: s[t.id].map((x, k) => (k === i ? { ...x, ...patch, approved: false } : x)) })); const bad = !/^\d{4}-\d{2}-\d{2}$/.test(e.date); return <tr key={i}>
                  <td className="py-1 pr-2"><select value={e.investorKey ?? ""} onChange={(ev) => set({ investorKey: ev.target.value || null })} className={`${inp} ${e.investorKey ? "" : "border-amber-300"}`}><option value="">— pick —</option>{t.tags.map((g) => <option key={g.id} value={g.name}>{g.name}</option>)}</select></td>
                  <td className="py-1 pr-2"><select value={e.type} onChange={(ev) => set({ type: ev.target.value as IrActivityType })} className={inp}>{IR_ACTIVITY_TYPES.map((k) => <option key={k} value={k}>{IR_ACTIVITY_LABEL[k]}</option>)}</select></td>
                  <td className="py-1 pr-2"><input value={e.outcome} onChange={(ev) => set({ outcome: ev.target.value })} className={`w-full ${inp}`} /></td>
                  <td className="py-1 pr-2"><input type="date" value={e.date} onChange={(ev) => set({ date: ev.target.value })} className={`${inp} ${bad ? "border-rose-400" : ""}`} aria-invalid={bad} /></td>
                  <td className="py-1 text-right"><button type="button" onClick={() => setEdits((s) => ({ ...s, [t.id]: s[t.id].filter((_, k) => k !== i) }))} className="text-[11.5px] text-slate-400 hover:text-rose-600">Remove</button></td>
                </tr>; })}</tbody></table> : null}
            </div>
          ); })}
          {tasks.length === 0 ? <p className="rounded-xl border border-slate-200 bg-white p-4 text-[12.5px] text-slate-400">Every selected task is already imported.</p> : null}
          <div className="rounded-xl border border-slate-200 bg-white p-4 text-[12.5px] text-slate-600">
            <p>Import writes: 1 project ({target === "new" ? "new" : "existing"}), {tasks.length} task{tasks.length === 1 ? "" : "s"}, {tagsInUse.length - unresolved.length} investor match{tagsInUse.length - unresolved.length === 1 ? "" : "es"} (duplicates on a project are reused), and every approved activity with its date. Stages are set from the activities and their history is backdated so past-period reports read correctly. No intro to-dos are created for imported investors.</p>
            {unresolved.length ? <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-amber-800">{unresolved.length} investor tag{unresolved.length === 1 ? "" : "s"} without a Sales Hub contact will be skipped: {unresolved.join("; ")}. Add them in Sales Hub later and run this import again — it only adds what is missing.</p> : null}
            <div className="mt-3 flex items-center justify-between"><button type="button" onClick={() => setStep(3)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-[12.5px] text-slate-600 hover:bg-slate-50">← Back</button><button type="button" disabled={busy || notApproved > 0 || !tasks.length} title={notApproved ? "Approve every task first" : ""} onClick={runImport} className="rounded-lg bg-indigo-600 px-4 py-1.5 text-[12.5px] font-semibold text-white hover:bg-indigo-700 disabled:opacity-60">{busy ? "Importing…" : "Import into IR Hub"}</button></div>
          </div>
        </div>
      ) : null}

      {step === 5 && result && loaded ? (
        <div className="rounded-xl border border-emerald-200 bg-white p-5">
          <h3 className="text-[16px] font-semibold text-emerald-800">Import complete</h3>
          <p className="mt-1 text-[12.5px] text-slate-600">Reconciled against the Odoo read. Odoo itself was not changed.</p>
          <table className="mt-3 w-full max-w-lg text-[12.5px]"><thead><tr className="text-left text-[11px] text-slate-500"><th className="py-1 font-medium">Item</th><th className="py-1 text-right font-medium">Odoo</th><th className="py-1 text-right font-medium">IR Hub</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              <tr><td className="py-1">Projects (months)</td><td className="py-1 text-right">{picked.size}</td><td className="py-1 text-right">1 project · {picked.size} month milestone{picked.size === 1 ? "" : "s"}</td></tr>
              <tr><td className="py-1">Tasks</td><td className="py-1 text-right">{loaded.tasks.length}</td><td className="py-1 text-right">{result.tasksCreated} created{result.tasksSkipped ? ` · ${result.tasksSkipped} already there` : ""}</td></tr>
              <tr><td className="py-1">Investor tags</td><td className="py-1 text-right">{tagsInUse.length}</td><td className="py-1 text-right">{result.matchesCreated} matches{result.matchesReused ? ` · ${result.matchesReused} reused` : ""}</td></tr>
              <tr><td className="py-1">Agent Field entries</td><td className="py-1 text-right">{tasks.reduce((n, t) => n + t.entries.length, 0)}</td><td className="py-1 text-right">{result.activitiesCreated} activities · {result.stagesSet} stages set</td></tr>
            </tbody></table>
          {result.warnings.length || unresolved.length ? <ul className="mt-3 list-disc pl-5 text-[12px] text-amber-800">{unresolved.length ? <li>Skipped (no Sales Hub contact): {unresolved.join("; ")}</li> : null}{result.warnings.map((w, i) => <li key={i}>{w}</li>)}</ul> : null}
          <div className="mt-4 flex gap-2"><Link href={`/admin/ir/projects/${result.projectId}`} className="rounded-lg bg-indigo-600 px-4 py-1.5 text-[12.5px] font-semibold text-white hover:bg-indigo-700">Open the pipeline</Link><Link href={`/admin/ir/projects/${result.projectId}/tasks`} className="rounded-lg border border-slate-200 px-3 py-1.5 text-[12.5px] text-slate-700 hover:bg-slate-50">Task board</Link><button type="button" onClick={() => { setStep(1); setLoaded(null); setResult(null); fetch("/api/admin/ir/import").then((r) => r.json()).then(setSetup); }} className="ml-auto rounded-lg border border-slate-200 px-3 py-1.5 text-[12.5px] text-slate-700 hover:bg-slate-50">Import another founder</button></div>
        </div>
      ) : null}
      </>}
    </div>
  );
}

function ReconcilePanel() {
  const [projects, setProjects] = useState<Array<{ id: string; title: string; founder_name: string | null; status: string }> | null>(null);
  const [pid, setPid] = useState("");
  const [r, setR] = useState<ReconcileResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    fetch("/api/admin/ir/import/reconcile").then((x) => x.json()).then((j) => { if (!live) return; if (j.error) { setErr(j.error); return; } setProjects(j.projects ?? []); });
    return () => { live = false; };
  }, []);
  async function run() {
    if (!pid) return;
    setBusy(true); setErr(null); setR(null);
    const x = await fetch(`/api/admin/ir/import/reconcile?project=${pid}`); const j = await x.json().catch(() => ({}));
    setBusy(false);
    if (!x.ok) { setErr(j.error ?? "Couldn't reconcile."); return; }
    setR(j);
  }
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3">
        <span className="text-[13px] font-semibold text-slate-900">Reconcile an imported project with Odoo</span>
        <select value={pid} onChange={(e) => setPid(e.target.value)} className={inp}><option value="">Choose a project…</option>{(projects ?? []).map((p) => <option key={p.id} value={p.id}>{p.title}{p.founder_name ? ` · ${p.founder_name}` : ""} ({p.status})</option>)}</select>
        <button type="button" disabled={!pid || busy} onClick={run} className="rounded-lg bg-indigo-600 px-3.5 py-1.5 text-[12.5px] font-semibold text-white hover:bg-indigo-700 disabled:opacity-60">{busy ? "Reading Odoo…" : "Compare"}</button>
        {projects && projects.length === 0 ? <span className="text-[12px] text-slate-400">No project has been imported from Odoo yet.</span> : null}
      </div>
      {err ? <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[12.5px] text-rose-700">{err}</div> : null}
      {r ? (
        <>
          <div className="grid gap-3 lg:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <h3 className="mb-1 text-[14px] font-semibold text-slate-900">Totals · {r.project.title}</h3>
              <table className="w-full text-[12.5px]"><thead><tr className="text-left text-[11px] text-slate-500"><th className="py-1 font-medium">Item</th><th className="py-1 text-right font-medium">Odoo</th><th className="py-1 text-right font-medium">IR Hub</th><th className="py-1 text-right font-medium">Δ</th></tr></thead><tbody className="divide-y divide-slate-100"><Row row={r.totals.tasks} /><Row row={r.totals.investors} /><Row row={r.totals.activities} /></tbody></table>
              <p className="mt-2 text-[11.5px] text-slate-400">Read {new Date(r.readAt).toLocaleString()}. Activities in the IR Hub include anything logged here since the import, so a positive Δ after cutover is expected; Odoo entries are the parsed Agent Field.</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <h3 className="mb-1 text-[14px] font-semibold text-slate-900">By month</h3>
              <table className="w-full text-[12.5px]"><thead><tr className="text-left text-[11px] text-slate-500"><th className="py-1 font-medium">Odoo project</th><th className="py-1 text-right font-medium">Tasks Odoo</th><th className="py-1 text-right font-medium">IR</th><th className="py-1 text-right font-medium">Entries Odoo</th><th className="py-1 text-right font-medium">IR</th></tr></thead>
                <tbody className="divide-y divide-slate-100">{r.byMonth.map((m, i) => <tr key={i}><td className="py-1.5 pr-2 text-slate-800">{m.odooProject}{m.month ? <span className="text-slate-400"> · Month {m.month}</span> : null}</td><td className="py-1.5 text-right">{m.tasks.odoo}</td><td className={`py-1.5 text-right ${m.tasks.ir === m.tasks.odoo ? "text-emerald-700" : "text-amber-800"}`}>{m.tasks.ir}</td><td className="py-1.5 text-right">{m.entries.odoo}</td><td className={`py-1.5 text-right ${m.entries.ir >= m.entries.odoo ? "text-emerald-700" : "text-amber-800"}`}>{m.entries.ir}</td></tr>)}</tbody></table>
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <h3 className="mb-1 text-[14px] font-semibold text-slate-900">Weekly counts · Odoo vs IR Hub</h3>
            <p className="mb-2 text-[11.5px] text-slate-500">Rollout step 6: compare each week&rsquo;s emails, calls and meetings while both systems run. Dates come from the Agent Field on the Odoo side and from done activities on the IR side.</p>
            {r.byWeek.length === 0 ? <p className="text-[12.5px] text-slate-400">No dated activity on either side yet.</p> : <table className="w-full text-[12.5px]"><thead><tr className="text-left text-[11px] text-slate-500"><th className="py-1 font-medium">Week</th><th className="py-1 text-right font-medium">Emails O / IR</th><th className="py-1 text-right font-medium">Calls O / IR</th><th className="py-1 text-right font-medium">Meetings O / IR</th></tr></thead>
              <tbody className="divide-y divide-slate-100">{r.byWeek.map((w) => { const c = (a: number, b: number) => (a === b ? "text-emerald-700" : "text-amber-800"); return <tr key={w.week}><td className="py-1.5 pr-2 text-slate-800">{w.week} <span className="text-slate-400">{w.range}</span></td><td className={`py-1.5 text-right ${c(w.odoo.emails, w.ir.emails)}`}>{w.odoo.emails} / {w.ir.emails}</td><td className={`py-1.5 text-right ${c(w.odoo.calls, w.ir.calls)}`}>{w.odoo.calls} / {w.ir.calls}</td><td className={`py-1.5 text-right ${c(w.odoo.meetings, w.ir.meetings)}`}>{w.odoo.meetings} / {w.ir.meetings}</td></tr>; })}</tbody></table>}
          </div>
          <div className="grid gap-3 lg:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <h3 className="mb-1 text-[14px] font-semibold text-slate-900">Odoo tasks not in the IR Hub <span className="font-normal text-slate-500">· {r.drift.tasksNotImported.length}</span></h3>
              {r.drift.tasksNotImported.length === 0 ? <p className="text-[12.5px] text-emerald-700">Every Odoo task is imported.</p> : <><ul className="max-h-48 overflow-auto text-[12.5px] text-slate-700">{r.drift.tasksNotImported.map((t) => <li key={t.id} className="py-0.5">{t.name} <span className="text-slate-400">· {t.project}</span></li>)}</ul><p className="mt-2 text-[11.5px] text-slate-500">Run Import for this founder again — tasks already in the IR Hub are skipped, only these are added.</p></>}
              {r.drift.irTasksNotInOdoo ? <p className="mt-2 text-[11.5px] text-slate-500">{r.drift.irTasksNotInOdoo} IR Hub task{r.drift.irTasksNotInOdoo === 1 ? "" : "s"} created here after import (no Odoo counterpart) — expected once work moves to the IR Hub.</p> : null}
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <h3 className="mb-1 text-[14px] font-semibold text-slate-900">Odoo investor tags with no match <span className="font-normal text-slate-500">· {r.drift.tagsUnmatched.length}</span></h3>
              {r.drift.tagsUnmatched.length === 0 ? <p className="text-[12.5px] text-emerald-700">Every tag resolved to an Investor Contact.</p> : <><ul className="max-h-48 overflow-auto text-[12.5px] text-slate-700">{r.drift.tagsUnmatched.map((t) => <li key={t} className="py-0.5">{t}</li>)}</ul><p className="mt-2 text-[11.5px] text-slate-500">Add the investor in Sales Hub, then re-run Import — the tag resolves and the match is created.</p></>}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}

function Row({ row }: { row: ReconcileRow }) { const d = row.ir - row.odoo; return <tr><td className="py-1.5 pr-3 text-slate-800">{row.label}</td><td className="py-1.5 pr-3 text-right">{row.odoo}</td><td className="py-1.5 pr-3 text-right">{row.ir}</td><td className={`py-1.5 text-right ${d === 0 ? "text-emerald-700" : "text-amber-800"}`}>{d === 0 ? "match" : d > 0 ? `+${d}` : d}</td></tr>; }

function BackupPanel() {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <h3 className="text-[15px] font-semibold text-slate-900">Full Odoo snapshot</h3>
      <p className="mt-1 text-[12.5px] text-slate-600">Rollout step 8: before Odoo is turned off, download the complete Deals2Match record as JSON — every project, every task with its tags, assignee, dates and Agent Field, all tags, and the task chatter (mail.message). Odoo is only read. Keep the file with the company records; it is the reference if a count is ever questioned after cutover.</p>
      <a href="/api/admin/ir/import/snapshot" className="mt-3 inline-block rounded-lg bg-indigo-600 px-4 py-1.5 text-[12.5px] font-semibold text-white hover:bg-indigo-700">Download Odoo snapshot (JSON)</a>
      <p className="mt-3 text-[11.5px] text-slate-400">Reads 18 projects and their tasks live, so it can take a few seconds. After the snapshot and the final import, the <code>odoo_*</code> trace columns can be dropped in a later migration.</p>
    </div>
  );
}

function Nav({ onBack, onNext }: { onBack: () => void; onNext: () => void }) {
  return <div className="col-span-full flex justify-between"><button type="button" onClick={onBack} className="rounded-lg border border-slate-200 px-3 py-1.5 text-[12.5px] text-slate-600 hover:bg-slate-50">← Back</button><button type="button" onClick={onNext} className="rounded-lg bg-indigo-600 px-4 py-1.5 text-[12.5px] font-semibold text-white hover:bg-indigo-700">Next →</button></div>;
}

/** Links the new project to a Sales Hub contact or a company (a project needs one). Suggests by the founder name; search overrides. */
function FounderPicker({ seed, value, onChange }: { seed: string; value: FounderLink | null; onChange: (v: FounderLink | null) => void }) {
  const [q, setQ] = useState(seed);
  const [rows, setRows] = useState<FounderLink[]>([]);
  const [searched, setSearched] = useState(false);
  useEffect(() => {
    if (value || q.trim().length < 2) return;
    const h = setTimeout(() => {
      fetch("/api/admin/ir/import", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "founders", q: q.trim() }) }).then((r) => r.json()).then((j) => {
        const contacts = ((j.contacts ?? []) as Array<{ id: string; name: string | null; company: string | null; contact_type: string | null }>).map((c) => ({ kind: "contact" as const, id: c.id, label: c.name ?? "—", sub: [c.company, c.contact_type].filter(Boolean).join(" · ") || null }));
        const companies = ((j.companies ?? []) as Array<{ id: string; company_name: string }>).map((c) => ({ kind: "company" as const, id: c.id, label: c.company_name, sub: "Company" }));
        setRows([...contacts, ...companies]); setSearched(true);
      });
    }, 250);
    return () => clearTimeout(h);
  }, [q, value]);
  return (
    <div>
      <span>Link founder <span className="text-slate-400">(required — Sales Hub contact or company)</span></span>
      {value ? (
        <div className="mt-1 flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-[12.5px]">
          <span className="text-slate-900">{value.label}{value.sub ? <span className="text-slate-500"> · {value.sub}</span> : null}</span>
          <button type="button" onClick={() => { onChange(null); setSearched(false); }} className="text-[12px] text-slate-500 hover:text-slate-800">Change</button>
        </div>
      ) : (
        <>
          <input value={q} onChange={(e) => { setQ(e.target.value); setSearched(false); }} placeholder="Founder name or company…" className={`mt-1 w-full ${inp}`} />
          <ul className="mt-1 max-h-40 divide-y divide-slate-100 overflow-auto rounded-lg border border-slate-200 text-[12.5px]">
            {rows.map((r) => <li key={`${r.kind}:${r.id}`}><button type="button" onClick={() => onChange(r)} className="flex w-full items-center justify-between px-2.5 py-1.5 text-left hover:bg-slate-50"><span className="text-slate-900">{r.label}</span><span className="text-slate-500">{r.sub ?? ""}</span></button></li>)}
            {searched && rows.length === 0 ? <li className="px-2.5 py-2 text-slate-400">No contact or company matches. Add the founder in Sales Hub first, then search again.</li> : null}
            {q.trim().length < 2 ? <li className="px-2.5 py-2 text-slate-400">Type at least two letters.</li> : null}
          </ul>
        </>
      )}
    </div>
  );
}

function SearchDialog({ tag, onPick, onClose }: { tag: string; onPick: (c: Candidate) => void; onClose: () => void }) {
  const [q, setQ] = useState(tag.split(/[,(]/)[0].trim());
  const [rows, setRows] = useState<Candidate[]>([]);
  useEffect(() => {
    if (q.trim().length < 2) return;
    const h = setTimeout(() => { fetch(`/api/admin/ir/investors?q=${encodeURIComponent(q)}`).then((r) => r.json()).then((j) => setRows((j.investors ?? []).map((i: { id: string; name: string | null; firm: string | null; dataSource: string | null }) => ({ id: i.id, name: i.name, firm: i.firm, dataSource: i.dataSource })))); }, 250);
    return () => clearTimeout(h);
  }, [q]);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" role="dialog" aria-modal="true" aria-label="Find investor contact">
      <div className="w-full max-w-lg rounded-xl bg-white p-4 shadow-xl">
        <div className="mb-2 flex items-center justify-between"><h3 className="text-[14px] font-semibold text-slate-900">Find contact for &ldquo;{tag}&rdquo;</h3><button type="button" onClick={onClose} className="text-[12px] text-slate-500 hover:text-slate-800">Close</button></div>
        <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name or firm…" className={`w-full ${inp}`} />
        <ul className="mt-2 max-h-72 divide-y divide-slate-100 overflow-auto text-[12.5px]">{(q.trim().length >= 2 ? rows : []).map((c) => <li key={c.id}><button type="button" onClick={() => onPick(c)} className="flex w-full items-center justify-between px-1 py-1.5 text-left hover:bg-slate-50"><span className="text-slate-900">{c.name ?? "—"}</span><span className="text-slate-500">{c.firm ?? ""}</span></button></li>)}{q.length >= 2 && rows.length === 0 ? <li className="py-2 text-slate-400">No investor contacts match. Add the investor in Sales Hub first.</li> : null}</ul>
      </div>
    </div>
  );
}
