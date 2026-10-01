"use client";

/**
 * Autosaving contact editor for the IR "Open: Contact" window. Same layout as the read view:
 * contact fields up top, then tabs. Every field saves on its own (text on blur or Enter,
 * picklists on each change), shows Saving / Saved / Retry, and every save or confirm can be
 * undone from the bar that follows it or from the Undo button (back through this session).
 * History lists earlier edits with who made them, and restores an earlier value.
 * Server side: /api/admin/contacts/[id]/edit and src/lib/contacts/inline-edit.ts.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { groupContactProfile, type ProfileSection } from "@/lib/sales/contact-profile-sections";
import { INVESTOR_PROFILE_LABEL, INVESTOR_PROFILE_OPTIONS, isInvestorProfileLabel } from "@/lib/sales/investor-profile";

type Contact = {
  id: string; name: string; email: string | null; company: string | null; phone: string | null; phone2: string | null; website: string | null;
  membership: string | null; job_position: string | null; street: string | null; street2: string | null; city: string | null; state: string | null; zip: string | null; country: string | null;
  extra: Array<{ label: string; values: string[] }>;
};
type EditorData = { contact: Contact; tags: Record<string, string>; odoo: { linked: boolean; canWrite: boolean } };
type OdooResult = { status: "saved" | "skipped" | "failed"; message?: string };
type Tag = { sourceKey: string; tag: string };
type UndoEntry = { key: string; label: string; kind: "save" | "confirm"; before: string[]; after: string[]; tagBefore: Tag | null };
type History = { id: string; at: string; actor: string | null; field: string; before: string[] | null; after: string[] | null; confirmed: string | null; odoo: string | null };
type FieldState = "saving" | "saved" | "error";

const COLUMN_LABEL: Record<string, string> = {
  name: "Name", company: "Company", membership: "Membership type", job_position: "Job position", phone: "Phone", phone2: "Phone 2",
  email: "Email", website: "Website", street: "Street", street2: "Street 2", city: "City", state: "State", zip: "ZIP", country: "Country",
};
const COLUMNS = Object.keys(COLUMN_LABEL);
/** Prose fields: typed, never picked from a list (same set as the Sales Hub record). */
const FREE_TEXT = new Set(["Note", "Request", "Quick notes", "Pitch frame to use", "If other, referred you", "Company Name", "Company name", "Contact preference", "Investor business summary", "Investor short bio", "Investor special skills", "Investor work experience", "Short bio", "Special skills", "Work experience", "Business summary", "Management team", "Five key highlights", "LinkedIn", "AngelList", "Facebook", "Twitter / X", "Instagram", "Other"]);
const LONG_TEXT = new Set(["Investor business summary", "Business summary", "Short bio", "Special skills", "Work experience", "Management team", "Five key highlights", "Note", "Request", "Quick notes"]);
const PROFILE_TAB_SECTIONS = new Set(["Investor information", "Investor rating", "Investor thesis", "Entrepreneur information", "Seeking", "Company & stage"]);

function tagLabel(tag: string): string {
  if (tag.startsWith("derived:phone")) return "from phone";
  if (tag.startsWith("derived:email")) return "from email";
  if (tag.startsWith("site:")) return "from website";
  if (tag.startsWith("derived:")) return "derived";
  if (tag.startsWith("inferred:")) return `AI ${tag.slice(9)}`;
  return "guess";
}
const same = (a: string[], b: string[]) => a.length === b.length && a.every((x, i) => x === b[i]);
const fmt = (v: string[] | null) => (v && v.length ? v.join(", ") : "blank");

async function api<T>(id: string, body?: unknown, query = ""): Promise<T> {
  const res = await fetch(`/api/admin/contacts/${id}/edit${query}`, body ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : undefined);
  const d = await res.json().catch(() => ({ error: "Bad response." }));
  if (!res.ok) throw new Error(d.error ?? `Request failed (${res.status}).`);
  return d as T;
}

export function InlineContactEditor({ contactId, irTab, irLabel }: { contactId: string; irTab?: React.ReactNode; irLabel?: string }) {
  const [data, setData] = useState<EditorData | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [values, setValues] = useState<Record<string, string[]>>({});
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [tags, setTags] = useState<Record<string, string>>({});
  const [state, setState] = useState<Record<string, FieldState>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [odooNote, setOdooNote] = useState<string | null>(null);
  const [options, setOptions] = useState<Record<string, string[]>>({});
  const [undo, setUndo] = useState<UndoEntry[]>([]);
  const [toast, setToast] = useState<UndoEntry | null>(null);
  const [tab, setTab] = useState<"address" | "profile" | "about" | "ir">("profile");
  const [history, setHistory] = useState<History[] | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let live = true;
    api<EditorData>(contactId).then((d) => {
      if (!live) return;
      setData(d); setTags(d.tags);
      const v: Record<string, string[]> = {};
      for (const k of COLUMNS) { const x = (d.contact as unknown as Record<string, unknown>)[k]; v[k] = typeof x === "string" && x.trim() ? [x.trim()] : []; }
      for (const e of d.contact.extra) v[e.label] = e.values;
      setValues(v);
    }).catch((e) => { if (live) setLoadErr(e instanceof Error ? e.message : "Couldn't load the contact."); });
    fetch("/api/sales/contacts/field-options").then((r) => r.json()).then((d) => { if (live) setOptions(d.options ?? {}); }).catch(() => {});
    return () => { live = false; };
  }, [contactId]);

  const sections: ProfileSection[] = useMemo(() => {
    if (!data) return [];
    return groupContactProfile(Object.entries(values).filter(([k, v]) => !COLUMNS.includes(k) && v.length).map(([label, vs]) => ({ label, values: vs })), values.membership?.[0] ?? data.contact.membership).sections;
    // Grouping follows the saved values; drafts don't regroup mid-typing.
  }, [data, values]);
  const isFounder = /entrepreneur|founder/i.test(values.membership?.[0] ?? data?.contact.membership ?? "");

  const showToast = useCallback((e: UndoEntry) => {
    setToast(e);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 8000);
  }, []);

  async function save(key: string, label: string, next: string[], opts: { record?: boolean; restoreTag?: Tag | null } = {}) {
    const before = values[key] ?? [];
    setState((s) => ({ ...s, [key]: "saving" })); setErrors((e) => { const n = { ...e }; delete n[key]; return n; });
    setValues((v) => ({ ...v, [key]: next }));
    try {
      const r = await api<{ before: string[]; after: string[]; tagBefore: Tag | null; odoo: OdooResult }>(contactId, { op: "save", key, values: next, restoreTag: opts.restoreTag ?? null });
      setState((s) => ({ ...s, [key]: "saved" }));
      setTags((t) => { const n = { ...t }; if (opts.restoreTag) n[key] = opts.restoreTag.tag; else delete n[key]; return n; });
      setOdooNote(r.odoo.status === "failed" ? `Saved in iCapOS. Odoo update failed: ${r.odoo.message}` : r.odoo.status === "skipped" && data?.odoo.linked ? r.odoo.message ?? null : null);
      if (opts.record !== false) {
        const entry: UndoEntry = { key, label, kind: "save", before: r.before, after: r.after, tagBefore: r.tagBefore };
        setUndo((u) => [...u, entry]); showToast(entry);
      }
    } catch (e) {
      setValues((v) => ({ ...v, [key]: before }));
      setState((s) => ({ ...s, [key]: "error" }));
      setErrors((x) => ({ ...x, [key]: e instanceof Error ? e.message : "Couldn't save." }));
    }
  }

  async function confirm(key: string, label: string) {
    setState((s) => ({ ...s, [key]: "saving" }));
    try {
      const r = await api<{ tag: Tag | null }>(contactId, { op: "confirm", key });
      setState((s) => ({ ...s, [key]: "saved" }));
      setTags((t) => { const n = { ...t }; delete n[key]; return n; });
      if (r.tag) { const entry: UndoEntry = { key, label, kind: "confirm", before: values[key] ?? [], after: values[key] ?? [], tagBefore: r.tag }; setUndo((u) => [...u, entry]); showToast(entry); }
    } catch (e) {
      setState((s) => ({ ...s, [key]: "error" })); setErrors((x) => ({ ...x, [key]: e instanceof Error ? e.message : "Couldn't confirm." }));
    }
  }

  async function undoEntry(entry: UndoEntry) {
    setToast(null);
    setUndo((u) => u.filter((x) => x !== entry));
    if (entry.kind === "confirm" && entry.tagBefore) {
      try { await api(contactId, { op: "restore_tag", ...entry.tagBefore }); setTags((t) => ({ ...t, [entry.key]: entry.tagBefore!.tag })); }
      catch (e) { setErrors((x) => ({ ...x, [entry.key]: e instanceof Error ? e.message : "Couldn't undo." })); }
      return;
    }
    setDrafts((d) => { const n = { ...d }; delete n[entry.key]; return n; });
    await save(entry.key, entry.label, entry.before, { record: false, restoreTag: entry.tagBefore });
  }

  async function openHistory() {
    if (history) { setHistory(null); return; }
    try { setHistory((await api<{ history: History[] }>(contactId, undefined, "?history=1")).history); }
    catch { setHistory([]); }
  }

  const saving = Object.values(state).some((s) => s === "saving");
  const failed = Object.values(state).some((s) => s === "error");

  if (loadErr) return <p className="text-rose-600">{loadErr}</p>;
  if (!data) return <p className="text-slate-400">Loading…</p>;

  /* ---------------------------------------------------------------- controls */

  const status = (key: string) => {
    const s = state[key];
    if (s === "saving") return <span className="ml-auto whitespace-nowrap text-[11px] text-slate-400">Saving…</span>;
    if (s === "error") return null;
    if (s === "saved") return <span className="ml-auto whitespace-nowrap text-[11px] text-emerald-700"><i className="ti ti-check" aria-hidden="true" /> Saved</span>;
    return null;
  };
  const guessBadge = (key: string, label: string) => tags[key] ? (
    <span className="ml-auto flex items-center gap-1.5 whitespace-nowrap">
      <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] text-amber-800">{tagLabel(tags[key])}</span>
      <button type="button" onClick={() => void confirm(key, label)} className="text-[11px] font-medium text-indigo-700 hover:underline"><i className="ti ti-check" aria-hidden="true" /> Confirm</button>
    </span>
  ) : null;

  function textField(k: string, label: string, long?: boolean) {
    const cur = (values[k] ?? []).join(", ");
    const draft = drafts[k] ?? cur;
    const commit = () => {
      const next = draft.trim() ? (COLUMNS.includes(k) || FREE_TEXT.has(label) ? [draft.trim()] : draft.split(",").map((s) => s.trim()).filter(Boolean)) : [];
      if (!same(next, values[k] ?? [])) void save(k, label, next);
      setDrafts((d) => { const n = { ...d }; delete n[k]; return n; });
    };
    const cls = `w-full min-w-0 rounded-md border px-2 py-1 text-[13px] outline-none focus:border-indigo-400 ${state[k] === "error" ? "border-rose-400" : tags[k] ? "border-amber-300 bg-amber-50/40" : "border-slate-200"}`;
    return (
      <div className="min-w-0">
        {long
          ? <textarea rows={3} value={draft} placeholder="Blank. Type here." onChange={(e) => setDrafts((d) => ({ ...d, [k]: e.target.value }))} onBlur={commit} className={cls} />
          : <input value={draft} placeholder="Blank" onChange={(e) => setDrafts((d) => ({ ...d, [k]: e.target.value }))} onBlur={commit} onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); if (e.key === "Escape") { setDrafts((d) => { const n = { ...d }; delete n[k]; return n; }); } }} className={cls} />}
        {errors[k] ? <p className="mt-0.5 text-[11px] text-rose-600">{errors[k]} <button type="button" onClick={commit} className="font-medium underline">Retry</button></p> : null}
      </div>
    );
  }

  function chipsField(k: string, label: string, opts: string[]) {
    const cur = values[k] ?? [];
    const rest = opts.filter((o) => !cur.includes(o));
    const guess = Boolean(tags[k]);
    return (
      <div className="min-w-0">
        <div className={`flex min-h-[30px] flex-wrap items-center gap-1 rounded-md border px-1.5 py-1 ${state[k] === "error" ? "border-rose-400" : guess ? "border-amber-300 bg-amber-50/40" : "border-slate-200"}`}>
          {cur.map((v) => (
            <span key={v} className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11.5px] ${guess ? "bg-amber-100 text-amber-900" : "bg-indigo-50 text-indigo-700"}`}>
              {v}
              <button type="button" aria-label={`Remove ${v}`} onClick={() => void save(k, label, cur.filter((x) => x !== v))} className="opacity-60 hover:opacity-100"><i className="ti ti-x" aria-hidden="true" /></button>
            </span>
          ))}
          {rest.length ? (
            <select aria-label={`Add to ${label}`} value="" onChange={(e) => { if (e.target.value) void save(k, label, [...cur, e.target.value]); }} className="max-w-[9rem] rounded border-0 bg-transparent py-0 pl-1 pr-6 text-[12px] text-slate-500 focus:ring-0">
              <option value="">+ Add</option>
              {rest.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          ) : null}
        </div>
        {errors[k] ? <p className="mt-0.5 text-[11px] text-rose-600">{errors[k]}</p> : null}
      </div>
    );
  }

  function row(k: string, label: string) {
    const opts = k === "membership" ? ["Investor", "Entrepreneur", "Advisor"]
      : isInvestorProfileLabel(k) || k === INVESTOR_PROFILE_LABEL ? [...INVESTOR_PROFILE_OPTIONS]
      : COLUMNS.includes(k) || FREE_TEXT.has(label) ? [] : (options[k] ?? []);
    const control = k === "membership"
      ? (
        <select value={values.membership?.[0] ?? ""} onChange={(e) => void save("membership", label, e.target.value ? [e.target.value] : [])} className="w-full rounded-md border border-slate-200 px-2 py-1 text-[13px]">
          <option value="">Blank</option>
          {[...new Set([...opts, ...(values.membership ?? [])])].map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      )
      : opts.length ? chipsField(k, label, [...new Set([...opts, ...(values[k] ?? [])])]) : textField(k, label, LONG_TEXT.has(label));
    return (
      <div key={k} className="grid grid-cols-[130px_minmax(0,1fr)] items-start gap-2 py-1">
        <div className="pt-1.5 text-[12.5px] font-medium text-slate-600">{label}</div>
        <div className="min-w-0">
          {control}
          <div className="mt-0.5 flex min-h-[14px] items-center">{guessBadge(k, label) ?? status(k)}</div>
        </div>
      </div>
    );
  }

  const investorType = sections.flatMap((s) => s.fields).find((f) => isInvestorProfileLabel(f.label));
  const sectionRows = (filter: (title: string) => boolean) => sections
    .filter((s) => filter(s.title))
    .map((s) => ({ ...s, fields: s.fields.filter((f) => !isInvestorProfileLabel(f.label)) }))
    .filter((s) => s.fields.length);

  return (
    <div className="relative">
      <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-[12px]">
        <span className={failed ? "text-rose-600" : saving ? "text-slate-500" : "text-emerald-700"}>
          <i className={`ti ${failed ? "ti-alert-triangle" : saving ? "ti-loader" : "ti-cloud-check"}`} aria-hidden="true" />{" "}
          {failed ? "A field didn't save. It's marked in red." : saving ? "Saving…" : data.odoo.canWrite ? "All changes saved to Odoo and iCapOS" : data.odoo.linked ? "All changes saved to iCapOS (Odoo updates need an admin)" : "All changes saved to iCapOS"}
        </span>
        <span className="ml-auto" />
        <button type="button" disabled={!undo.length || saving} onClick={() => void undoEntry(undo[undo.length - 1])} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-slate-700 hover:bg-slate-50 disabled:opacity-40"><i className="ti ti-arrow-back-up" aria-hidden="true" /> Undo{undo.length ? ` (${undo.length})` : ""}</button>
        <button type="button" onClick={() => void openHistory()} className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 hover:bg-slate-50 ${history ? "border-indigo-300 bg-indigo-50 text-indigo-700" : "border-slate-200 bg-white text-slate-700"}`}><i className="ti ti-history" aria-hidden="true" /> History</button>
      </div>
      {odooNote ? <p className="mb-2 rounded-lg bg-amber-50 px-3 py-1.5 text-[12px] text-amber-800">{odooNote}</p> : null}

      {history ? (
        <div className="mb-3 max-h-56 overflow-y-auto rounded-lg border border-slate-200">
          {history.length === 0 ? <p className="px-3 py-2 text-[12px] text-slate-500">No edits from this window yet.</p> : history.map((h) => (
            <div key={h.id} className="flex items-start gap-2 border-b border-slate-100 px-3 py-1.5 text-[12px] last:border-b-0">
              <div className="min-w-0 flex-1">
                <span className="font-medium text-slate-800">{COLUMN_LABEL[h.field] ?? h.field}</span>{" "}
                {h.confirmed ? <span className="text-slate-500">confirmed ({tagLabel(h.confirmed)})</span> : <span className="text-slate-500">{fmt(h.before)} → {fmt(h.after)}</span>}
                <div className="text-[11px] text-slate-400">{h.actor ?? "Staff"} · {new Date(h.at).toLocaleString()}</div>
              </div>
              {!h.confirmed && h.before ? <button type="button" disabled={saving} onClick={() => void save(h.field, COLUMN_LABEL[h.field] ?? h.field, h.before ?? [])} className="whitespace-nowrap text-[11.5px] font-medium text-indigo-700 hover:underline disabled:opacity-40">Restore earlier value</button> : null}
            </div>
          ))}
        </div>
      ) : null}

      {textField("name", "Name")}
      <div className="mt-2 grid gap-x-6 sm:grid-cols-2">
        <div>{row("membership", "Membership type")}{row("company", "Company")}{row("country", "Country")}</div>
        <div>{row("job_position", "Job position")}{row("phone", "Phone")}{row("email", "Email")}{row("website", "Website")}</div>
      </div>

      <div className="mt-3 flex flex-wrap border-b border-slate-200" role="tablist">
        {([["address", "Contact and address"], ["profile", isFounder ? "Founder profile" : "Investor profile"], ["about", "About and social"], ...(irTab ? [["ir", irLabel ?? "IR projects"]] : [])] as Array<[typeof tab, string]>).map(([k, l]) => (
          <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={`-mb-px rounded-t-lg border px-3 py-2 text-[13px] ${tab === k ? "border-slate-200 border-b-white bg-white font-semibold text-slate-900" : "border-transparent text-slate-500 hover:text-slate-800"}`}>{l}</button>
        ))}
      </div>
      <div className="py-3">
        {tab === "address" ? (
          <div className="grid gap-x-6 sm:grid-cols-2">
            <div>{row("street", "Street")}{row("street2", "Street 2")}{row("city", "City")}</div>
            <div>{row("state", "State")}{row("zip", "ZIP")}{row("country", "Country")}{row("phone2", "Phone 2")}</div>
          </div>
        ) : tab === "ir" ? irTab : (
          <div>
            {tab === "profile" && !isFounder ? row(investorType?.saveKey ?? INVESTOR_PROFILE_LABEL, "Investor type") : null}
            {sectionRows((t) => (tab === "profile" ? PROFILE_TAB_SECTIONS.has(t) : !PROFILE_TAB_SECTIONS.has(t))).map((s) => (
              <div key={s.title} className="mt-2">
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">{s.title}</p>
                <div className="grid gap-x-6 sm:grid-cols-2">
                  {s.fields.map((f) => row(f.saveKey, f.label))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {toast ? (
        <div role="status" className="sticky bottom-0 flex items-center gap-3 rounded-lg bg-slate-900 px-3 py-2 text-[12.5px] text-white shadow-lg">
          <i className="ti ti-check" aria-hidden="true" />
          <span className="min-w-0 flex-1 truncate">
            {toast.kind === "confirm" ? `${toast.label} confirmed` : `${toast.label} saved: ${fmt(toast.after)}`}
          </span>
          <button type="button" onClick={() => void undoEntry(toast)} className="font-semibold underline">Undo</button>
        </div>
      ) : null}
    </div>
  );
}
