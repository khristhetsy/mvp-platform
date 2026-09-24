"use client";

/**
 * Profile and fields.
 *
 * Options tab: one section per field. Where used tab: every field against every
 * screen, with its wiring one click away. Each field has its own toolbar:
 * Undo and Redo walk that field's unsaved edits, Save publishes them as a new
 * version, Unsave returns to the previous saved version, Default stages the
 * built in list, and Options holds history, compare, retired, export, import.
 */

import Link from "next/link";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { CODE_FALLBACK, type VocabularyList } from "@/lib/vocabulary/lists";
import {
  FIELD_SECTIONS,
  FIELD_USAGE,
  SURFACES,
  type Cell,
  type FieldSection,
  type FieldUsage,
  type Surface,
} from "@/lib/profile-fields/catalog";
import {
  applyDefault,
  checkSave,
  countChanges,
  defaultOne,
  fromCsv,
  newSlug,
  toCsv,
  type DraftOption,
} from "@/lib/profile-fields/draft";
import type { EngineWeights } from "@/lib/matching/investor-company-matching";
import { fieldByName, appliesTo, type DisplaySurface, type ResolvedSurface } from "@/lib/profile-fields/display";

/** Where used columns that have Shown and Required. */
const DISPLAY_SURFACE_FOR: Partial<Record<Surface, DisplaySurface>> = {
  "Founder onboarding": "founder_onboarding",
  "Founder settings": "founder_settings",
  Other: "admin_editors",
};

export type FieldVersion = { version: number; note: string | null; created_at: string };

type FieldState = {
  saved: DraftOption[];
  draft: DraftOption[];
  past: DraftOption[][];
  future: DraftOption[][];
  versions: FieldVersion[] | null;
};

type Props = {
  initial: Record<string, DraftOption[]>;
  counts: Record<string, Record<string, number>>;
  weights: EngineWeights;
  display: Record<DisplaySurface, ResolvedSurface>;
};

const FACTOR_FOR_ROW: Record<string, keyof EngineWeights> = {
  Industry: "sector",
  "Funding stage": "stage",
  "Operating stage": "stage",
  "Revenue stage": "stage",
  ARR: "arr",
  MRR: "mrr",
  "Amount of capital": "checkSize",
  "Investor type": "investorType",
  "Capital type": "capitalType",
  Geography: "geography",
};

const CARD = "rounded-xl border border-slate-200 bg-white";
const BTN = "inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40";
const BTN_PRIMARY = "inline-flex items-center gap-1 rounded-md border border-blue-600 bg-blue-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40";
const PILL: Record<Cell["kind"], string> = {
  picks: "bg-emerald-50 text-emerald-700",
  scores: "bg-blue-50 text-blue-700",
  typed: "bg-amber-50 text-amber-800",
  never: "bg-rose-50 text-rose-700",
  none: "",
};
const PILL_TEXT: Record<Cell["kind"], string> = { picks: "Picks", scores: "Scores", typed: "Typed", never: "Never scores", none: "" };

function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/csv" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

export function ProfileFieldsManager({ initial, counts, weights: initialWeights, display: initialDisplay }: Readonly<Props>) {
  const [display, setDisplay] = useState(initialDisplay);
  const [tab, setTab] = useState<"options" | "used">("options");
  const [fields, setFields] = useState<Record<string, FieldState>>(() => {
    const out: Record<string, FieldState> = {};
    for (const s of FIELD_SECTIONS) {
      const opts = initial[s.list] ?? [];
      out[s.list] = { saved: opts, draft: opts, past: [], future: [], versions: null };
    }
    return out;
  });
  const [open, setOpen] = useState<VocabularyList | null>("revenue_size");
  const [openRow, setOpenRow] = useState<string | null>(null);
  const [cellEdit, setCellEdit] = useState<{ row: string; surface: Surface } | null>(null);
  const [weights, setWeights] = useState<EngineWeights>(initialWeights);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ kind: "ok" | "bad"; text: string } | null>(null);

  const pendingTotal = useMemo(
    () => Object.values(fields).reduce((n, f) => n + countChanges(f.saved, f.draft), 0),
    [fields],
  );

  // Leaving with unsaved edits asks first.
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (pendingTotal > 0) { e.preventDefault(); e.returnValue = ""; }
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [pendingTotal]);

  function edit(list: VocabularyList, next: DraftOption[]) {
    setFields((p) => {
      const f = p[list];
      return { ...p, [list]: { ...f, draft: next, past: [...f.past, f.draft].slice(-100), future: [] } };
    });
  }
  function undo(list: VocabularyList) {
    setFields((p) => {
      const f = p[list];
      if (!f.past.length) return p;
      return { ...p, [list]: { ...f, draft: f.past[f.past.length - 1], past: f.past.slice(0, -1), future: [f.draft, ...f.future] } };
    });
  }
  function redo(list: VocabularyList) {
    setFields((p) => {
      const f = p[list];
      if (!f.future.length) return p;
      return { ...p, [list]: { ...f, draft: f.future[0], past: [...f.past, f.draft], future: f.future.slice(1) } };
    });
  }

  async function loadVersions(list: VocabularyList) {
    const res = await fetch(`/api/admin/profile-fields?list=${list}`);
    const json = (await res.json().catch(() => ({}))) as { versions?: FieldVersion[] };
    setFields((p) => ({ ...p, [list]: { ...p[list], versions: json.versions ?? [] } }));
  }

  async function post(list: VocabularyList, body: Record<string, unknown>, okText: string) {
    setBusy(list);
    setMsg(null);
    const res = await fetch("/api/admin/profile-fields", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = (await res.json().catch(() => ({}))) as { options?: DraftOption[]; versions?: FieldVersion[]; error?: string };
    setBusy(null);
    if (!res.ok || !json.options) { setMsg({ kind: "bad", text: json.error ?? "That didn't save." }); return; }
    setFields((p) => ({ ...p, [list]: { saved: json.options!, draft: json.options!, past: [], future: [], versions: json.versions ?? null } }));
    setMsg({ kind: "ok", text: okText });
  }

  function save(section: FieldSection) {
    const f = fields[section.list];
    const check = checkSave(f.saved, f.draft, section);
    if (!check.ok) { setMsg({ kind: "bad", text: check.reason }); return; }
    void post(section.list, { action: "save", list: section.list, options: f.draft }, `${section.title} saved.`);
  }

  async function unsave(section: FieldSection) {
    let versions = fields[section.list].versions;
    if (!versions) {
      const res = await fetch(`/api/admin/profile-fields?list=${section.list}`);
      versions = ((await res.json().catch(() => ({}))) as { versions?: FieldVersion[] }).versions ?? [];
    }
    if (versions.length < 2) { setMsg({ kind: "bad", text: `${section.title} has no earlier saved version to return to.` }); return; }
    const target = versions[1].version;
    if (!window.confirm(`Roll ${section.title} back to version ${target}? This is saved as a new version and can itself be undone the same way.`)) return;
    void post(section.list, { action: "restore", list: section.list, version: target }, `${section.title} rolled back to version ${target}.`);
  }

  function restore(section: FieldSection, version: number) {
    if (!window.confirm(`Restore ${section.title} to version ${version}?`)) return;
    void post(section.list, { action: "restore", list: section.list, version }, `${section.title} restored to version ${version}.`);
  }

  async function saveDisplay(surface: DisplaySurface, key: string, shown: boolean, required: boolean) {
    setBusy("display");
    setMsg(null);
    const res = await fetch("/api/admin/profile-fields", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "display", surface, key, shown, required }),
    });
    const json = (await res.json().catch(() => ({}))) as { error?: string; resolved?: ResolvedSurface };
    setBusy(null);
    if (!res.ok || !json.resolved) { setMsg({ kind: "bad", text: json.error ?? "Could not save the setting." }); return; }
    setDisplay((d) => ({ ...d, [surface]: json.resolved! }));
    setMsg({ kind: "ok", text: !shown ? "Hidden on that screen." : required ? "Shown and required." : "Shown, optional." });
    setCellEdit(null);
  }

  async function saveWeight(factor: keyof EngineWeights, weight: number) {
    setBusy("weight");
    setMsg(null);
    const res = await fetch("/api/admin/profile-fields", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "weight", factor, weight }),
    });
    const json = (await res.json().catch(() => ({}))) as { error?: string };
    setBusy(null);
    if (!res.ok) { setMsg({ kind: "bad", text: json.error ?? "Could not save the weight." }); return; }
    setWeights((w) => ({ ...w, [factor]: weight }));
    setMsg({ kind: "ok", text: weight === 0 ? "Factor turned off." : `Weight saved: ${weight}.` });
    setCellEdit(null);
  }

  return (
    <div>
      {msg ? (
        <p role="status" className={`mb-3 rounded-lg px-3 py-2 text-sm ${msg.kind === "ok" ? "bg-emerald-50 text-emerald-800" : "bg-rose-50 text-rose-700"}`}>{msg.text}</p>
      ) : null}

      <div role="tablist" className="mb-4 flex gap-1 border-b border-slate-200">
        {(["options", "used"] as const).map((t) => (
          <button
            type="button"
            key={t}
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={`-mb-px border-b-2 px-3.5 py-2 text-sm font-semibold ${tab === t ? "border-blue-600 text-blue-700" : "border-transparent text-slate-500 hover:text-slate-700"}`}
          >
            {t === "options" ? "Options" : "Where used"}
          </button>
        ))}
        {pendingTotal > 0 ? <span className="ml-auto self-center text-xs font-semibold text-amber-700">{pendingTotal} unsaved {pendingTotal === 1 ? "change" : "changes"} across fields</span> : null}
      </div>

      {tab === "options" ? (
        <div>
          {(["Company profile", "Revenue and financials", "Investor fit"] as const).map((group) => (
            <Fragment key={group}>
              <p className="mb-2 mt-5 text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-500 first:mt-0">{group}</p>
              {FIELD_SECTIONS.filter((s) => s.group === group).map((s) => (
                <SectionCard
                  key={s.list}
                  section={s}
                  state={fields[s.list]}
                  counts={counts[s.list] ?? {}}
                  weight={s.factor ? weights[s.factor] : undefined}
                  open={open === s.list}
                  busy={busy === s.list}
                  onToggle={() => setOpen(open === s.list ? null : s.list)}
                  onEdit={(next) => edit(s.list, next)}
                  toolbar={
                    <FieldToolbar
                      section={s}
                      state={fields[s.list]}
                      busy={busy === s.list}
                      onUndo={() => undo(s.list)}
                      onRedo={() => redo(s.list)}
                      onSave={() => save(s)}
                      onUnsave={() => void unsave(s)}
                      onDefault={() => edit(s.list, applyDefault(fields[s.list].draft, CODE_FALLBACK[s.list]))}
                      onLoadVersions={() => void loadVersions(s.list)}
                      onRestore={(v) => restore(s, v)}
                      onImport={(next) => edit(s.list, next)}
                      onError={(text) => setMsg({ kind: "bad", text })}
                    />
                  }
                />
              ))}
            </Fragment>
          ))}
        </div>
      ) : (
        <WhereUsed
          openRow={openRow}
          setOpenRow={setOpenRow}
          cellEdit={cellEdit}
          setCellEdit={setCellEdit}
          weights={weights}
          display={display}
          busy={busy === "weight" || busy === "display"}
          onSaveWeight={(f, w) => void saveWeight(f, w)}
          onSaveDisplay={(sf, k, sh, rq) => void saveDisplay(sf, k, sh, rq)}
          toolbarFor={(u) => {
            const s = FIELD_SECTIONS.find((x) => x.list === u.list);
            if (!s) return null;
            return (
              <FieldToolbar
                section={s}
                state={fields[s.list]}
                busy={busy === s.list}
                onUndo={() => undo(s.list)}
                onRedo={() => redo(s.list)}
                onSave={() => save(s)}
                onUnsave={() => void unsave(s)}
                onDefault={() => edit(s.list, applyDefault(fields[s.list].draft, CODE_FALLBACK[s.list]))}
                onLoadVersions={() => void loadVersions(s.list)}
                onRestore={(v) => restore(s, v)}
                onImport={(next) => edit(s.list, next)}
                onError={(text) => setMsg({ kind: "bad", text })}
              />
            );
          }}
        />
      )}
    </div>
  );
}

/* ── Field toolbar ────────────────────────────────────────────────────── */

function FieldToolbar(props: Readonly<{
  section: FieldSection;
  state: FieldState;
  busy: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onSave: () => void;
  onUnsave: () => void;
  onDefault: () => void;
  onLoadVersions: () => void;
  onRestore: (version: number) => void;
  onImport: (next: DraftOption[]) => void;
  onError: (text: string) => void;
}>) {
  const { section, state } = props;
  const [menu, setMenu] = useState(false);
  const [compare, setCompare] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const pending = countChanges(state.saved, state.draft);
  const fallback = CODE_FALLBACK[section.list];
  const differs = state.draft.filter((o) => {
    const f = fallback.find((x) => x.slug === o.slug);
    return !f || f.label !== o.label || (f.description ?? "") !== (o.description ?? "") || o.archived;
  });

  return (
    <div className="relative mb-3 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5">
      <div role="toolbar" aria-label={`${section.title} changes`} className="flex flex-wrap items-center gap-1.5">
        <span className="mr-1 text-xs font-semibold text-slate-700">{section.title}</span>
        <button type="button" className={BTN} onClick={props.onUndo} disabled={!state.past.length || props.busy} title="Undo">↶ Undo</button>
        <button type="button" className={BTN} onClick={props.onRedo} disabled={!state.future.length || props.busy} title="Redo">↷ Redo</button>
        {pending > 0 ? (
          <span className="ml-1 inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700"><span className="h-2 w-2 rounded-full bg-amber-500" />{pending} unsaved</span>
        ) : (
          <span className="ml-1 text-xs text-slate-400">No unsaved changes</span>
        )}
        <div className="ml-auto flex items-center gap-1.5">
          <button type="button" className={BTN} onClick={props.onUnsave} disabled={props.busy} title="Roll back to the previous saved version">Unsave</button>
          <button type="button" className={BTN} onClick={props.onDefault} disabled={props.busy} title="Stage the built in list; Save to apply">Default</button>
          <button type="button" className={BTN_PRIMARY} onClick={props.onSave} disabled={!pending || props.busy}>{props.busy ? "Saving…" : "Save"}</button>
          <button
            type="button"
            className={BTN}
            aria-haspopup="menu"
            aria-expanded={menu}
            onClick={() => { const next = !menu; setMenu(next); if (next && !state.versions) props.onLoadVersions(); }}
          >
            ⚙ Options ▾
          </button>
        </div>
      </div>

      {menu ? (
        <div role="menu" className="absolute right-2 top-10 z-20 w-80 rounded-lg border border-slate-200 bg-white p-1.5 shadow-lg">
          <p className="px-2 pb-1 pt-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">{section.title} versions</p>
          {state.versions === null ? <p className="px-2 py-1.5 text-xs text-slate-500">Loading…</p> : null}
          {state.versions?.length === 0 ? <p className="px-2 py-1.5 text-xs text-slate-500">Never edited. The first Save creates version 2 and keeps today&apos;s list as version 1.</p> : null}
          {state.versions?.map((v, i) => (
            <div key={v.version} className="flex items-start justify-between gap-2 border-t border-slate-100 px-2 py-1.5 text-xs">
              <span>Version {v.version}{i === 0 ? " · current" : ""}<span className="block text-slate-500">{v.note ?? "Saved"} · {new Date(v.created_at).toLocaleString()}</span></span>
              {i > 0 ? <button type="button" className="shrink-0 font-medium text-blue-700" onClick={() => { setMenu(false); props.onRestore(v.version); }}>Restore</button> : null}
            </div>
          ))}
          <p className="px-2 pb-1 pt-2.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">More</p>
          <button type="button" role="menuitem" className="block w-full rounded px-2 py-1.5 text-left text-sm hover:bg-slate-50" onClick={() => setCompare((c) => !c)}>{compare ? "Hide" : "Compare with"} default</button>
          <button type="button" role="menuitem" className="block w-full rounded px-2 py-1.5 text-left text-sm hover:bg-slate-50" onClick={() => { download(`${section.list}.csv`, toCsv(state.draft)); setMenu(false); }}>Export {section.title} (CSV)</button>
          <button type="button" role="menuitem" className="block w-full rounded px-2 py-1.5 text-left text-sm hover:bg-slate-50" onClick={() => fileRef.current?.click()}>Import {section.title} (CSV)</button>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (!file) return;
              const r = fromCsv(await file.text(), state.draft);
              if (!r.ok) { props.onError(r.reason); return; }
              props.onImport(r.options);
              setMenu(false);
            }}
          />
        </div>
      ) : null}

      {compare ? (
        <div className="mt-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
          {differs.length === 0 ? "Matches the built in list." : (
            <ul className="space-y-0.5">
              {differs.map((o) => {
                const f = fallback.find((x) => x.slug === o.slug);
                return (
                  <li key={o.slug}>
                    <b>{o.label}</b>{" "}
                    {!f ? "is not in the built in list" : o.archived ? "is retired (offered by default)" : `reads "${f.label}" by default`}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}

/* ── Options tab section ──────────────────────────────────────────────── */

function SectionCard(props: Readonly<{
  section: FieldSection;
  state: FieldState;
  counts: Record<string, number>;
  weight?: number;
  open: boolean;
  busy: boolean;
  onToggle: () => void;
  onEdit: (next: DraftOption[]) => void;
  toolbar: React.ReactNode;
}>) {
  const { section, state } = props;
  const [renaming, setRenaming] = useState<string | null>(null);
  const [draftLabel, setDraftLabel] = useState("");
  const [draftDesc, setDraftDesc] = useState("");
  const [showRetired, setShowRetired] = useState(true);
  const [newLabel, setNewLabel] = useState("");
  const offeredCount = state.draft.filter((o) => !o.archived).length;
  const savedBySlug = useMemo(() => new Map(state.saved.map((o) => [o.slug, o])), [state.saved]);
  const fallback = CODE_FALLBACK[section.list];

  const set = (slug: string, patch: Partial<DraftOption>) =>
    props.onEdit(state.draft.map((o) => (o.slug === slug ? { ...o, ...patch } : o)));
  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= state.draft.length) return;
    const next = [...state.draft];
    [next[i], next[j]] = [next[j], next[i]];
    props.onEdit(next);
  };
  const add = () => {
    const label = newLabel.trim();
    if (label.length < 2) return;
    const slug = newSlug(label, section);
    if (!slug || state.draft.some((o) => o.slug === slug)) return;
    props.onEdit([...state.draft, { slug, label, archived: false, description: null }]);
    setNewLabel("");
  };

  return (
    <div className={`${CARD} mb-2.5`}>
      <div className="flex flex-wrap items-start gap-3 px-4 py-3">
        <div className="min-w-0">
          <p className="font-semibold text-slate-900">
            {section.title}
            {!section.wired ? <span className="ml-2 rounded bg-amber-50 px-1.5 py-0.5 text-[11px] font-semibold text-amber-800">Not read by forms yet</span> : null}
          </p>
          <p className="text-xs text-slate-500">{section.note}</p>
        </div>
        <div className="ml-auto flex items-center gap-2.5 whitespace-nowrap text-xs text-slate-500">
          {offeredCount} offered{props.weight !== undefined ? ` · weight ${props.weight}` : ""}
          <button type="button" className={BTN} onClick={props.onToggle} aria-expanded={props.open}>{props.open ? "Close" : "Open"}</button>
        </div>
      </div>

      {props.open ? (
        <div className="border-t border-slate-200 px-4 pb-4 pt-3">
          {props.toolbar}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-500">
                  <th className="w-16 py-1.5 font-semibold">Order</th>
                  <th className="py-1.5 font-semibold">Label (what people read)</th>
                  {section.hasDescription ? <th className="py-1.5 font-semibold">Description</th> : null}
                  <th className="py-1.5 font-semibold">Stored key</th>
                  <th className="py-1.5 font-semibold">Answers</th>
                  <th className="py-1.5" />
                </tr>
              </thead>
              <tbody>
                {state.draft.map((o, i) => {
                  if (o.archived && !showRetired) return null;
                  const before = savedBySlug.get(o.slug);
                  const changed = !before || before.label !== o.label || before.archived !== o.archived || (before.description ?? "") !== (o.description ?? "") || state.saved.indexOf(before) !== i;
                  const isRenaming = renaming === o.slug;
                  const n = props.counts[o.slug];
                  return (
                    <tr key={o.slug} className={`border-t border-slate-100 ${o.archived ? "text-slate-400" : ""}`}>
                      <td className="py-1.5">
                        <button type="button" aria-label={`Move ${o.label} up`} className="px-1 text-slate-400 hover:text-slate-700 disabled:opacity-30" disabled={i === 0} onClick={() => move(i, -1)}>↑</button>
                        <button type="button" aria-label={`Move ${o.label} down`} className="px-1 text-slate-400 hover:text-slate-700 disabled:opacity-30" disabled={i === state.draft.length - 1} onClick={() => move(i, 1)}>↓</button>
                      </td>
                      <td className="py-1.5">
                        {isRenaming ? (
                          <input autoFocus aria-label="New label" className="w-full max-w-xs rounded border border-blue-500 px-2 py-1 text-sm" value={draftLabel} onChange={(e) => setDraftLabel(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { set(o.slug, { label: draftLabel, ...(section.hasDescription ? { description: draftDesc || null } : {}) }); setRenaming(null); } if (e.key === "Escape") setRenaming(null); }} />
                        ) : (
                          <span className={o.archived ? "line-through" : ""}>{o.label}</span>
                        )}
                        {changed ? <span title="Unsaved" className="ml-1.5 inline-block h-2 w-2 rounded-full bg-amber-500 align-middle" /> : null}
                      </td>
                      {section.hasDescription ? (
                        <td className="py-1.5 text-slate-600">
                          {isRenaming ? <input aria-label="Description" className="w-full max-w-xs rounded border border-blue-500 px-2 py-1 text-sm" value={draftDesc} onChange={(e) => setDraftDesc(e.target.value)} /> : o.description}
                        </td>
                      ) : null}
                      <td className="py-1.5 font-mono text-xs text-slate-500">{o.slug}</td>
                      <td className="py-1.5 text-slate-600">{section.answerColumns ? (n ?? 0) : "—"}</td>
                      <td className="whitespace-nowrap py-1.5 text-right text-xs">
                        {isRenaming ? (
                          <>
                            <button type="button" className="mr-3 font-medium text-blue-700" onClick={() => { set(o.slug, { label: draftLabel, ...(section.hasDescription ? { description: draftDesc || null } : {}) }); setRenaming(null); }}>Apply</button>
                            <button type="button" className="text-slate-500" onClick={() => setRenaming(null)}>Cancel</button>
                          </>
                        ) : (
                          <>
                            <button type="button" className="mr-3 font-medium text-blue-700" onClick={() => { setRenaming(o.slug); setDraftLabel(o.label); setDraftDesc(o.description ?? ""); }}>{section.hasDescription ? "Edit" : "Rename"}</button>
                            <button type="button" className="mr-3 font-medium text-blue-700" onClick={() => set(o.slug, { archived: !o.archived })}>{o.archived ? "Restore" : "Retire"}</button>
                            {fallback.some((f) => f.slug === o.slug) ? (
                              <button type="button" className="font-medium text-blue-700" onClick={() => props.onEdit(state.draft.map((x) => (x.slug === o.slug ? defaultOne(x, fallback) : x)))}>Default</button>
                            ) : null}
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {section.addable ? (
            <div className="mt-3 flex gap-2">
              <input aria-label="New option label" className="min-w-[220px] rounded-md border border-dashed border-slate-300 px-2.5 py-1.5 text-sm" placeholder="New option label" value={newLabel} onChange={(e) => setNewLabel(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") add(); }} />
              <button type="button" className={BTN_PRIMARY} onClick={add} disabled={newLabel.trim().length < 2}>Add</button>
            </div>
          ) : null}
          <label className="mt-3 flex items-center gap-2 text-xs text-slate-500">
            <input type="checkbox" checked={showRetired} onChange={(e) => setShowRetired(e.target.checked)} /> Show retired options
          </label>
          <p className="mt-2 text-xs text-slate-500">
            {section.answerColumns ? `Answers counts companies holding each value (${section.answerColumns.join(" + ")}). ` : ""}
            Retire hides a value from new answers; records that hold it keep it. Edits here are staged: Save on the toolbar publishes them.
          </p>
        </div>
      ) : null}
    </div>
  );
}

/* ── Where used tab ───────────────────────────────────────────────────── */

function WhereUsed(props: Readonly<{
  openRow: string | null;
  setOpenRow: (v: string | null) => void;
  cellEdit: { row: string; surface: Surface } | null;
  setCellEdit: (v: { row: string; surface: Surface } | null) => void;
  weights: EngineWeights;
  display: Record<DisplaySurface, ResolvedSurface>;
  busy: boolean;
  onSaveWeight: (factor: keyof EngineWeights, weight: number) => void;
  onSaveDisplay: (surface: DisplaySurface, key: string, shown: boolean, required: boolean) => void;
  toolbarFor: (u: FieldUsage) => React.ReactNode;
}>) {
  const editing = props.cellEdit ? FIELD_USAGE.find((u) => u.name === props.cellEdit!.row) : null;

  return (
    <div className={`grid gap-4 ${editing ? "lg:grid-cols-[minmax(0,1fr)_320px]" : ""}`}>
      <div>
        <div className="mb-3 flex flex-wrap gap-3 text-xs text-slate-500">
          {(["picks", "scores", "typed", "never"] as const).map((k) => (
            <span key={k}><span className={`rounded px-1.5 py-0.5 font-semibold ${PILL[k]}`}>{PILL_TEXT[k]}</span> {k === "picks" ? "asked with this list" : k === "scores" ? "feeds a match score" : k === "typed" ? "asked as free text" : "scored but never contributes"}</span>
          ))}
          <span>— not used there</span>
        </div>
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full min-w-[980px] border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 text-slate-500">
                <th className="sticky left-0 border-b border-slate-200 bg-slate-50 px-3 py-2 text-left font-semibold">Field</th>
                {SURFACES.map((s) => <th key={s} className="border-b border-l border-slate-200 px-2 py-2 font-semibold">{s}</th>)}
              </tr>
            </thead>
            <tbody>
              {FIELD_USAGE.map((u) => {
                const isOpen = props.openRow === u.name;
                return (
                  <Fragment key={u.name}>
                    <tr className="align-top">
                      <td className="sticky left-0 border-t border-slate-200 bg-white px-3 py-2">
                        <button type="button" aria-expanded={isOpen} className="text-left text-[13px] font-semibold text-blue-700" onClick={() => props.setOpenRow(isOpen ? null : u.name)}>
                          {isOpen ? "▾" : "▸"} {u.name}
                        </button>
                        <span className="mt-0.5 block text-[11px] text-slate-500">{u.summary}</span>
                      </td>
                      {SURFACES.map((s) => {
                        const c = u.cells[s];
                        const factor = s === "Matching" ? FACTOR_FOR_ROW[u.name] : undefined;
                        const selected = props.cellEdit?.row === u.name && props.cellEdit.surface === s;
                        return (
                          <td key={s} className={`border-l border-t border-slate-200 px-2 py-2 text-center ${selected ? "bg-blue-50 outline outline-2 -outline-offset-2 outline-blue-500" : ""}`}>
                            {c && c.kind !== "none" ? <span className={`rounded px-1.5 py-0.5 font-semibold ${PILL[c.kind]}`}>{PILL_TEXT[c.kind]}</span> : !c ? <span className="text-slate-300">—</span> : null}
                            {c?.note ? <span className="mt-0.5 block text-[11px] leading-tight text-slate-500">{c.note}{factor ? `, weight ${props.weights[factor]}` : ""}</span> : null}
                            {(() => {
                              const ds = DISPLAY_SURFACE_FOR[s];
                              const df = fieldByName(u.name);
                              const r = ds && df ? props.display[ds]?.[df.key] : undefined;
                              if (!r) return null;
                              return (
                                <span className={`mt-0.5 block text-[11px] font-semibold ${r.shown ? "text-slate-600" : "text-rose-700"}`}>
                                  {r.shown ? (r.required ? "Required" : "Optional") : "Hidden"}{r.locked ? " · locked" : ""}
                                </span>
                              );
                            })()}
                            <button type="button" className="mt-1 rounded border border-slate-200 px-1.5 text-[11px] font-medium text-blue-700 hover:bg-slate-50" onClick={() => props.setCellEdit(selected ? null : { row: u.name, surface: s })}>
                              {selected ? "Editing" : "Edit"}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                    {isOpen ? (
                      <tr>
                        <td colSpan={SURFACES.length + 1} className="border-t border-slate-200 bg-slate-50 px-3 py-3">
                          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">Wired to · {u.name}</p>
                          {props.toolbarFor(u)}
                          <table className="w-full text-xs">
                            <tbody>
                              {([["Screens", u.screens], ["Stored in", u.stored], ["Saved by", u.saved], ["Read by", u.read], ["Option list", u.optionList]] as const).map(([k, vals]) => (
                                <tr key={k} className="border-t border-slate-200 align-top">
                                  <th className="w-32 py-1.5 pr-3 text-left font-semibold text-slate-500">{k}</th>
                                  <td className="py-1.5">
                                    <span className="flex flex-wrap gap-1">
                                      {vals.map((v) => <code key={v} className="rounded border border-slate-200 bg-white px-1.5 font-mono text-[11px] text-slate-700">{v}</code>)}
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {editing && props.cellEdit ? (
        <CellEditor
          key={`${editing.name}:${props.cellEdit.surface}:${props.weights[FACTOR_FOR_ROW[editing.name] ?? "sector"]}:${JSON.stringify(props.display)}`}
          usage={editing}
          surface={props.cellEdit.surface}
          weights={props.weights}
          display={props.display}
          busy={props.busy}
          onClose={() => props.setCellEdit(null)}
          onSaveWeight={props.onSaveWeight}
          onSaveDisplay={props.onSaveDisplay}
        />
      ) : null}
    </div>
  );
}

function CellEditor(props: Readonly<{
  usage: FieldUsage;
  surface: Surface;
  weights: EngineWeights;
  display: Record<DisplaySurface, ResolvedSurface>;
  busy: boolean;
  onClose: () => void;
  onSaveWeight: (factor: keyof EngineWeights, weight: number) => void;
  onSaveDisplay: (surface: DisplaySurface, key: string, shown: boolean, required: boolean) => void;
}>) {
  const { usage, surface } = props;
  const displaySurface = DISPLAY_SURFACE_FOR[surface];
  const dField = fieldByName(usage.name);
  const dCurrent = displaySurface && dField && appliesTo(dField, displaySurface) ? props.display[displaySurface]?.[dField.key] : undefined;
  const [shown, setShown] = useState(dCurrent?.shown ?? true);
  const [required, setRequired] = useState(dCurrent?.required ?? false);
  const cell = usage.cells[surface];
  const factor = surface === "Matching" ? FACTOR_FOR_ROW[usage.name] : undefined;
  const current = factor ? props.weights[factor] : 0;
  const [on, setOn] = useState(current > 0);
  const [weight, setWeight] = useState(current > 0 ? current : 5);

  return (
    <aside className={`${CARD} self-start p-4 lg:sticky lg:top-4`} aria-label={`Edit ${usage.name} in ${surface}`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-slate-900">{usage.name} · {surface}</p>
          <p className="text-xs text-slate-500">{cell ? `${PILL_TEXT[cell.kind] || "Shown"}${cell.note ? `, ${cell.note}` : ""}` : "Not used here today."}</p>
        </div>
        <button type="button" aria-label="Close" className="text-slate-400 hover:text-slate-700" onClick={props.onClose}>✕</button>
      </div>

      {factor ? (
        <div className="mt-3">
          <label className="flex items-center justify-between text-sm">
            <span>Counts toward the match score</span>
            <input type="checkbox" checked={on} onChange={(e) => setOn(e.target.checked)} />
          </label>
          <label className="mt-3 block text-xs font-semibold text-slate-500" htmlFor="pf-weight">Weight</label>
          <input id="pf-weight" type="number" min={1} max={100} disabled={!on} value={weight} onChange={(e) => setWeight(Math.max(1, Math.min(100, Number(e.target.value) || 1)))} className="mt-1 w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm disabled:bg-slate-50" />
          {factor === "stage" ? <p className="mt-1.5 text-xs text-slate-500">Funding, operating and revenue stage share one stage factor, so this weight applies to all three.</p> : null}
          <p className="mt-1.5 text-xs text-slate-500">Same setting as the admin matching weights. Saving here updates it there too, immediately, and is recorded in the audit log.</p>
          <div className="mt-3 flex gap-2">
            <button type="button" className={BTN_PRIMARY} disabled={props.busy} onClick={() => props.onSaveWeight(factor, on ? weight : 0)}>{props.busy ? "Saving…" : "Save"}</button>
            <button type="button" className={BTN} onClick={props.onClose}>Cancel</button>
          </div>
        </div>
      ) : displaySurface && dField && dCurrent ? (
        <div className="mt-3">
          <label className="flex items-center justify-between gap-3 border-b border-slate-100 py-2 text-sm">
            <span>Shown on this screen{dCurrent.locked ? <span className="block text-xs text-slate-500">Locked: {dCurrent.lockReason}</span> : null}</span>
            <input type="checkbox" checked={shown} disabled={dCurrent.locked} onChange={(e) => { setShown(e.target.checked); if (!e.target.checked) setRequired(false); }} />
          </label>
          <label className="flex items-center justify-between gap-3 border-b border-slate-100 py-2 text-sm">
            <span>
              Required
              <span className="block text-xs text-slate-500">
                {displaySurface === "admin_editors" ? "Staff screens are never blocked." : displaySurface === "founder_onboarding" ? "Next stays disabled until it is answered." : "Save is blocked while it is empty."}
              </span>
            </span>
            <input type="checkbox" checked={required} disabled={dCurrent.locked || !shown || displaySurface === "admin_editors"} onChange={(e) => setRequired(e.target.checked)} />
          </label>
          <div className="flex items-center justify-between gap-3 py-2 text-sm">
            <span>Question type<span className="block text-xs text-slate-500">Fixed in code: matching reads the stored value.</span></span>
            <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-semibold">{cell ? PILL_TEXT[cell.kind] || "Shown" : "—"} · fixed</span>
          </div>
          {displaySurface === "founder_onboarding" && dField.onboardingStep && [3, 4].includes(dField.onboardingStep) && !shown ? (
            <p className="mt-1 text-xs text-slate-500">This is the only question on onboarding step {dField.onboardingStep}, so the step is skipped.</p>
          ) : null}
          <div className="mt-3 flex gap-2">
            <button type="button" className={BTN_PRIMARY} disabled={props.busy || dCurrent.locked} onClick={() => props.onSaveDisplay(displaySurface, dField.key, shown, shown && required)}>{props.busy ? "Saving…" : "Apply"}</button>
            <button type="button" className={BTN} onClick={props.onClose}>Cancel</button>
          </div>
          <p className="mt-2 text-xs text-slate-500">Applies immediately and is recorded in the audit log.</p>
        </div>
      ) : surface === "Event registration" ? (
        <div className="mt-3 text-sm text-slate-700">
          <p>Each event has its own versioned registration questions, edited on the event.</p>
          <Link href="/admin/events" className={`${BTN} mt-3`}>Open events</Link>
        </div>
      ) : (
        <div className="mt-3 text-sm text-slate-700">
          <p>How this field is asked on this screen is set in code today.</p>
          <p className="mt-2 text-xs text-slate-500">Its option labels, order and retired values are edited in the Options tab and reach this screen when the field reads a managed list. Changing the question type here (pick one, pick several, free text, not asked) is the next build step.</p>
        </div>
      )}
    </aside>
  );
}
