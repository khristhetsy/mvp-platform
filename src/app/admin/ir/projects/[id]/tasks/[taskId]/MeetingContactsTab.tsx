"use client";

/**
 * Meetings tab, Odoo style: the contacts linked to this week as a list (click a row to open the
 * contact), "Add a line" opens a searchable picker over all CRM contacts, and "New" in the picker
 * creates a contact and links it. Links live in ir_task_meeting_contacts, so Matching is untouched.
 * Contacts are read and written through the Sales contacts API, so edits here are the same record
 * as in the Sales Hub and the Investor Directory.
 */
import { useCallback, useEffect, useState } from "react";

type Act = { type: string; title: string; due: string | null; state: string } | null;
type Row = { id: string; name: string; company: string; membership: string; createdBy: string; phone: string; email: string; createdOn: string; activity: Act; city: string; country: string };
type Pick = { id: string; name: string; company: string; type: string; email: string; phone: string; createdOn: string; activity: Act };

const PAGE = 80;
const LEAD_STATUSES = ["new", "contacted", "qualified", "paused", "not interested", "won", "lost"];
const FIELD_KEYS = ["company", "membership", "member_portal_plan", "lead_status", "lead_source", "street", "street2", "city", "state", "zip", "country", "ein", "operator_licence", "curp", "job_position", "phone", "phone2", "email", "website", "language"] as const;
type FieldKey = (typeof FIELD_KEYS)[number];
type Vals = Record<FieldKey | "name" | "tags", string>;
const EMPTY: Vals = { name: "", tags: "", ...Object.fromEntries(FIELD_KEYS.map((k) => [k, ""])) } as Vals;
const LABEL: Record<FieldKey, string> = {
  company: "Company", membership: "Membership type", member_portal_plan: "Member portal plan", lead_status: "Lead status", lead_source: "Lead source",
  street: "Street", street2: "Street 2", city: "City", state: "State", zip: "ZIP", country: "Country", ein: "EIN", operator_licence: "Operator licence", curp: "CURP",
  job_position: "Job position", phone: "Phone", phone2: "Phone 2", email: "Email", website: "Website", language: "Language",
};
const LEFT: FieldKey[] = ["membership", "member_portal_plan", "lead_status", "lead_source", "street", "street2", "city", "state", "zip", "country", "ein", "operator_licence", "curp"];
const RIGHT: FieldKey[] = ["job_position", "phone", "phone2", "email", "website", "language"];
const inp = "w-full border-0 border-b border-slate-200 bg-transparent px-0.5 py-1 text-[13px] focus:border-indigo-400 focus:outline-none";
const btn = "rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[13px] text-slate-700 hover:bg-slate-50";
const btnPrimary = "rounded-lg bg-indigo-600 px-3 py-1.5 text-[13px] font-medium text-white hover:bg-indigo-700 disabled:opacity-50";

async function api(url: string, method: string, body?: unknown) {
  const r = await fetch(url, { method, headers: body ? { "Content-Type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error ?? "Something went wrong. Try again.");
  return j;
}
const actText = (a: Act) => (a ? a.type : "");
const actCls = (a: Act) => (a?.state === "overdue" ? "text-rose-600" : "text-slate-600");

function Modal({ title, onClose, children, footer }: { title: string; onClose: () => void; children: React.ReactNode; footer: React.ReactNode }) {
  useEffect(() => { const esc = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); }; document.addEventListener("keydown", esc); return () => document.removeEventListener("keydown", esc); }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-slate-900/40" onClick={onClose} aria-hidden="true" />
      <div className="relative flex max-h-[90vh] w-full max-w-[920px] flex-col rounded-xl border border-slate-200 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3"><h2 className="text-[15px] font-semibold text-slate-900">{title}</h2><button type="button" onClick={onClose} aria-label="Close" className="text-slate-500 hover:text-slate-800"><i className="ti ti-x" aria-hidden="true" /></button></div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
        <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 px-5 py-3">{footer}</div>
      </div>
    </div>
  );
}

function ContactForm({ v, set, createdOn }: { v: Vals; set: (k: keyof Vals, x: string) => void; createdOn?: string }) {
  const field = (k: FieldKey) => (
    <label key={k} className="grid grid-cols-[130px_1fr] items-center gap-3 text-[13px]"><span className="text-slate-600">{LABEL[k]}</span>
      {k === "lead_status" ? <select className={inp} value={v[k]} onChange={(e) => set(k, e.target.value)}><option value="" />{LEAD_STATUSES.map((s) => <option key={s} value={s}>{s[0].toUpperCase() + s.slice(1)}</option>)}</select>
        : <input className={inp} value={v[k]} onChange={(e) => set(k, e.target.value)} placeholder={k === "job_position" ? "e.g. Sales Director" : k === "website" ? "e.g. https://www.icapos.com" : ""} />}
    </label>
  );
  return (
    <div>
      <input className="w-full border-0 border-b-2 border-indigo-500 bg-transparent px-0.5 py-1 text-[22px] font-medium focus:outline-none" value={v.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Brandon Freeman" aria-label="Contact name" autoFocus />
      <input className="mt-1 w-full border-0 bg-transparent px-0.5 py-1 text-[13px] text-slate-600 focus:outline-none" value={v.company} onChange={(e) => set("company", e.target.value)} placeholder="Company name" aria-label="Company name" />
      <div className="mt-4 grid gap-x-8 gap-y-2 md:grid-cols-2">
        <div className="flex flex-col gap-2">{LEFT.map(field)}</div>
        <div className="flex flex-col gap-2">{RIGHT.map(field)}
          <label className="grid grid-cols-[130px_1fr] items-center gap-3 text-[13px]"><span className="text-slate-600">Tags</span><input className={inp} value={v.tags} onChange={(e) => set("tags", e.target.value)} placeholder="e.g. B2B, VIP, Consulting" /></label>
          {createdOn !== undefined ? <div className="grid grid-cols-[130px_1fr] gap-3 text-[13px]"><span className="text-slate-600">Created on</span><span className="text-slate-800">{createdOn || "—"}</span></div> : null}
        </div>
      </div>
    </div>
  );
}

/** Fields the contact API accepts; blanks are skipped on create and cleared on edit. */
function patchBody(v: Vals, create: boolean) {
  const o: Record<string, unknown> = {};
  for (const k of FIELD_KEYS) { if (k === "company" || k === "phone" || k === "email") continue; const x = v[k].trim(); if (create ? x : true) o[k] = x || null; }
  if (!create) { o.company = v.company.trim() || null; o.phone = v.phone.trim() || null; o.email = v.email.trim() || null; o.name = v.name.trim(); }
  const tags = v.tags.split(",").map((t) => t.trim()).filter(Boolean); if (!create || tags.length) o.tags = tags;
  return o;
}

export function MeetingContactsTab({ taskId, onCount }: { taskId: string; onCount: (n: number) => void }) {
  const base = `/api/admin/ir/tasks/${taskId}/meeting-contacts`;
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [picker, setPicker] = useState(false);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);

  const load = useCallback(async () => {
    try { const j = await api(base, "GET"); setRows(j.contacts); onCount(j.contacts.length); setError(null); } catch (e) { setError(e instanceof Error ? e.message : "Couldn't load the meetings."); }
  }, [base, onCount]);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch, then set
  useEffect(() => { void load(); }, [load]);

  async function remove(id: string) { try { await api(base, "DELETE", { contactId: id }); await load(); } catch (e) { setError(e instanceof Error ? e.message : "Couldn't remove the contact."); } }

  return (
    <div>
      {error ? <p role="alert" className="mb-2 text-[12.5px] text-rose-600">{error}</p> : null}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[860px] table-fixed border-collapse text-[12.5px]">
          <thead><tr className="border-b border-slate-200 text-left text-slate-500">
            {["Name", "Company", "Membership", "Created by", "Phone", "Email", "Created on", "Activities", "City", "Country"].map((h) => <th key={h} className="px-2 py-2 font-medium">{h}</th>)}<th className="w-8" />
          </tr></thead>
          <tbody>
            {(rows ?? []).map((r) => (
              <tr key={r.id} onClick={() => setEditing(r.id)} className="cursor-pointer border-b border-slate-100 hover:bg-slate-50">
                <td className="truncate px-2 py-2 font-medium text-slate-900">{r.name}</td><td className="truncate px-2 py-2">{r.company}</td>
                <td className="px-2 py-2">{r.membership ? <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[11.5px] text-indigo-700">{r.membership}</span> : null}</td>
                <td className="truncate px-2 py-2">{r.createdBy}</td><td className="truncate px-2 py-2">{r.phone}</td><td className="truncate px-2 py-2">{r.email}</td>
                <td className="truncate px-2 py-2">{r.createdOn.slice(0, 10)}</td>
                <td className={`truncate px-2 py-2 ${actCls(r.activity)}`} title={r.activity ? `${r.activity.title}${r.activity.due ? ` · due ${r.activity.due}` : ""}` : undefined}>{actText(r.activity)}</td>
                <td className="truncate px-2 py-2">{r.city}</td><td className="truncate px-2 py-2">{r.country}</td>
                <td className="px-2 py-2 text-right"><button type="button" aria-label={`Remove ${r.name}`} onClick={(e) => { e.stopPropagation(); void remove(r.id); }} className="text-slate-500 hover:text-rose-600"><i className="ti ti-x" aria-hidden="true" /></button></td>
              </tr>
            ))}
            <tr><td colSpan={11} className="px-2 py-2.5"><button type="button" onClick={() => setPicker(true)} className="text-[13px] text-indigo-700 hover:underline">Add a line</button></td></tr>
            {rows && rows.length === 0 ? <tr><td colSpan={11} className="px-2 pb-3 text-[12.5px] text-slate-400">No meetings linked to this week yet.</td></tr> : null}
          </tbody>
        </table>
      </div>
      {picker ? <Picker base={base} onClose={() => setPicker(false)} onAdded={() => { setPicker(false); void load(); }} onNew={() => { setPicker(false); setCreating(true); }} /> : null}
      {creating ? <CreateDialog base={base} onClose={() => setCreating(false)} onSaved={() => void load()} /> : null}
      {editing ? <EditDialog id={editing} onClose={() => setEditing(null)} onSaved={() => void load()} /> : null}
    </div>
  );
}

function Picker({ base, onClose, onAdded, onNew }: { base: string; onClose: () => void; onAdded: () => void; onNew: () => void }) {
  const [q, setQ] = useState(""); const [dq, setDq] = useState("");
  const [page, setPage] = useState(0);
  const [rows, setRows] = useState<Pick[]>([]); const [total, setTotal] = useState(0);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [err, setErr] = useState<string | null>(null); const [busy, setBusy] = useState(false);
  useEffect(() => { const t = setTimeout(() => { setDq(q); setPage(0); }, 300); return () => clearTimeout(t); }, [q]);
  useEffect(() => {
    let live = true;
    void api(`/api/sales/contacts?q=${encodeURIComponent(dq)}&offset=${page * PAGE}&limit=${PAGE}`, "GET")
      .then((j) => { if (live) { setRows(j.contacts); setTotal(j.total ?? j.contacts.length); setErr(null); } })
      .catch((e) => { if (live) setErr(e instanceof Error ? e.message : "Couldn't search contacts."); });
    return () => { live = false; };
  }, [dq, page]);
  const from = total ? page * PAGE + 1 : 0; const to = Math.min(total, page * PAGE + rows.length);
  const toggle = (id: string) => setSel((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  async function add() {
    setBusy(true);
    try { for (const id of sel) await api(base, "POST", { contactId: id }); onAdded(); } catch (e) { setErr(e instanceof Error ? e.message : "Couldn't add the contacts."); setBusy(false); }
  }
  return (
    <Modal title="Add: Meetings" onClose={onClose} footer={<><button type="button" className={btnPrimary} disabled={busy} onClick={() => (sel.size ? void add() : setErr("Tick at least one contact."))}>{sel.size ? `Select (${sel.size})` : "Select"}</button><button type="button" className={btn} onClick={onNew}>New</button><button type="button" className={btn} onClick={onClose}>Close</button>{err ? <span role="alert" className="text-[12.5px] text-rose-600">{err}</span> : null}</>}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <input className="w-full max-w-[280px] rounded-lg border border-slate-200 px-3 py-1.5 text-[13px] focus:border-indigo-400 focus:outline-none" placeholder="Search contacts" aria-label="Search contacts" value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
        <div className="flex items-center gap-2 text-[13px] text-slate-600"><span>{from}-{to} / {total.toLocaleString("en-US")}</span>
          <button type="button" className={btn} aria-label="Previous page" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}><i className="ti ti-chevron-left" aria-hidden="true" /></button>
          <button type="button" className={btn} aria-label="Next page" disabled={to >= total} onClick={() => setPage((p) => p + 1)}><i className="ti ti-chevron-right" aria-hidden="true" /></button></div>
      </div>
      <div className="overflow-x-auto"><table className="w-full min-w-[720px] table-fixed border-collapse text-[12.5px]">
        <thead><tr className="border-b border-slate-200 text-left text-slate-500"><th className="w-8 px-2 py-2" />{["Name", "Company", "Membership", "Phone", "Email", "Created on", "Activities"].map((h) => <th key={h} className="px-2 py-2 font-medium">{h}</th>)}</tr></thead>
        <tbody>{rows.map((r) => (
          <tr key={r.id} onClick={() => toggle(r.id)} className={`cursor-pointer border-b border-slate-100 hover:bg-slate-50 ${sel.has(r.id) ? "bg-indigo-50" : ""}`}>
            <td className="px-2 py-2"><input type="checkbox" checked={sel.has(r.id)} onChange={() => toggle(r.id)} onClick={(e) => e.stopPropagation()} aria-label={`Select ${r.name}`} /></td>
            <td className="truncate px-2 py-2 font-medium text-slate-900">{r.name}</td><td className="truncate px-2 py-2">{r.company}</td><td className="truncate px-2 py-2">{r.type}</td>
            <td className="truncate px-2 py-2">{r.phone}</td><td className="truncate px-2 py-2">{r.email}</td><td className="truncate px-2 py-2">{(r.createdOn ?? "").slice(0, 10)}</td><td className={`truncate px-2 py-2 ${actCls(r.activity)}`}>{actText(r.activity)}</td>
          </tr>))}
        </tbody></table></div>
    </Modal>
  );
}

function CreateDialog({ base, onClose, onSaved }: { base: string; onClose: () => void; onSaved: () => void }) {
  const [v, setV] = useState<Vals>(EMPTY); const [err, setErr] = useState<string | null>(null); const [busy, setBusy] = useState(false);
  const set = (k: keyof Vals, x: string) => setV((p) => ({ ...p, [k]: x }));
  async function save(close: boolean) {
    if (!v.name.trim()) { setErr("Enter a contact name."); return; }
    setBusy(true);
    try {
      const j = await api("/api/sales/contacts", "POST", { name: v.name.trim(), email: v.email.trim(), company: v.company.trim(), phone: v.phone.trim() });
      const id = j.contact.id as string;
      const extra = patchBody(v, true); if (Object.keys(extra).length) await api(`/api/sales/contacts/${id}`, "PATCH", extra);
      await api(base, "POST", { contactId: id });
      onSaved(); setErr(null);
      if (close) onClose(); else setV(EMPTY);
    } catch (e) { setErr(e instanceof Error ? e.message : "Couldn't save the contact."); } finally { setBusy(false); }
  }
  return (
    <Modal title="Create Meetings" onClose={onClose} footer={<><button type="button" className={btnPrimary} disabled={busy} onClick={() => void save(true)}>Save and close</button><button type="button" className={btn} disabled={busy} onClick={() => void save(false)}>Save and new</button><button type="button" className={btn} onClick={onClose}>Discard</button>{err ? <span role="alert" className="text-[12.5px] text-rose-600">{err}</span> : null}</>}>
      <ContactForm v={v} set={set} />
    </Modal>
  );
}

function EditDialog({ id, onClose, onSaved }: { id: string; onClose: () => void; onSaved: () => void }) {
  const [v, setV] = useState<Vals | null>(null); const [created, setCreated] = useState(""); const [err, setErr] = useState<string | null>(null); const [busy, setBusy] = useState(false);
  useEffect(() => {
    let live = true;
    void api(`/api/sales/contacts/${id}`, "GET").then((j) => {
      if (!live) return; const c = j.contact as Record<string, unknown>; const s = (k: string) => (typeof c[k] === "string" ? (c[k] as string) : "");
      const next: Vals = { ...EMPTY, name: s("name"), tags: Array.isArray(c.tags) ? (c.tags as string[]).join(", ") : "" };
      for (const k of FIELD_KEYS) next[k] = s(k);
      setV(next); setCreated(s("created_on").slice(0, 10));
    }).catch((e) => { if (live) setErr(e instanceof Error ? e.message : "Couldn't load the contact."); });
    return () => { live = false; };
  }, [id]);
  async function save() {
    if (!v) return; if (!v.name.trim()) { setErr("Enter a contact name."); return; }
    setBusy(true);
    try { await api(`/api/sales/contacts/${id}`, "PATCH", patchBody(v, false)); onSaved(); onClose(); } catch (e) { setErr(e instanceof Error ? e.message : "Couldn't save the contact."); setBusy(false); }
  }
  return (
    <Modal title="Open: Meetings" onClose={onClose} footer={<><button type="button" className={btnPrimary} disabled={busy || !v} onClick={() => void save()}>Save</button><button type="button" className={btn} onClick={onClose}>Discard</button>{err ? <span role="alert" className="text-[12.5px] text-rose-600">{err}</span> : null}</>}>
      {v ? <ContactForm v={v} set={(k, x) => setV((p) => (p ? { ...p, [k]: x } : p))} createdOn={created} /> : <p className="text-[13px] text-slate-500">{err ?? "Loading…"}</p>}
    </Modal>
  );
}
