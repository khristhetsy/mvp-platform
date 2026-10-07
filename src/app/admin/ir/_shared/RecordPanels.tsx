"use client";

/**
 * Panels shared by the Share Project record and the Task form (mockup tabs):
 *   BlockersPanel   — "Blocked by" list with presets, clear / remove, "Add blocker"
 *   EntrepreneurTab — the founder company snapshot (Company, Founder, Membership type,
 *                     Member portal plan, Raise, Stage, Industry) and the Odoo questionnaire,
 *                     each answer editable in place (saved to the founder contact)
 *   MessageComposer — "Send message" to followers (owner + assignee), kept on the record
 */
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { EntrepreneurProfile } from "@/lib/ir/db";
import type { ProfileRow } from "@/lib/ir/founder-profile";
import { BLOCKER_PRESETS, type IrBlocker } from "@/lib/ir/types";

const inp = "rounded-lg border border-slate-200 px-2.5 py-1.5 text-[12.5px] focus:border-indigo-400 focus:outline-none";

export function BlockersPanel({ blockers, dealTitle, onChange, busy }: { blockers: IrBlocker[]; dealTitle: string; onChange: (next: IrBlocker[]) => Promise<void>; busy: boolean }) {
  const [pick, setPick] = useState<string>(BLOCKER_PRESETS[0]);
  const [custom, setCustom] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const open = blockers.filter((b) => !b.cleared_at);
  async function add() {
    const label = (pick === "__custom" ? custom : pick).trim();
    if (!label) { setErr("Name the blocker."); return; }
    if (blockers.some((b) => !b.cleared_at && b.label.toLowerCase() === label.toLowerCase())) { setErr("That blocker is already on the record."); return; }
    setErr(null); setCustom("");
    await onChange([...blockers, { label, cleared_at: null }]);
  }
  return (
    <div>
      <table className="w-full text-[12.5px]">
        <thead><tr className="text-left text-[11px] text-slate-500"><th className="py-1 font-medium">Blocked by</th><th className="py-1 font-medium">Deal</th><th className="py-1 font-medium">Status</th><th className="py-1"></th></tr></thead>
        <tbody className="divide-y divide-slate-100">
          {blockers.map((b, i) => <tr key={i} className={b.cleared_at ? "text-slate-400" : ""}>
            <td className="py-1.5 pr-2">{b.cleared_at ? <s>{b.label}</s> : b.label}</td>
            <td className="py-1.5 pr-2">{dealTitle}</td>
            <td className="py-1.5 pr-2">{b.cleared_at ? `Cleared ${new Date(b.cleared_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}` : <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] text-amber-800">Blocking</span>}</td>
            <td className="py-1.5 text-right">
              {!b.cleared_at ? <button type="button" disabled={busy} onClick={() => onChange(blockers.map((x, k) => (k === i ? { ...x, cleared_at: new Date().toISOString() } : x)))} className="mr-2 text-[12px] text-emerald-700 hover:underline">Clear</button> : null}
              <button type="button" disabled={busy} onClick={() => onChange(blockers.filter((_, k) => k !== i))} className="text-[12px] text-slate-400 hover:text-rose-600">Remove</button>
            </td>
          </tr>)}
          {blockers.length === 0 ? <tr><td colSpan={4} className="py-3 text-slate-400">Nothing is blocking this record.</td></tr> : null}
        </tbody>
      </table>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <select value={pick} onChange={(e) => setPick(e.target.value)} className={inp}>{BLOCKER_PRESETS.map((p) => <option key={p} value={p}>{p}</option>)}<option value="__custom">Other…</option></select>
        {pick === "__custom" ? <input value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="What is blocking this?" className={`w-64 ${inp}`} /> : null}
        <button type="button" disabled={busy} onClick={add} className="rounded-md border border-slate-200 px-2.5 py-1 text-[12px] text-slate-700 hover:bg-slate-50 disabled:opacity-60">Add blocker</button>
        {err ? <span className="text-[12px] text-rose-600">{err}</span> : null}
        {open.length ? <span className="ml-auto text-[11.5px] text-amber-800">{open.length} open blocker{open.length === 1 ? "" : "s"}</span> : null}
      </div>
    </div>
  );
}

export function EntrepreneurTab({ e, onSaved }: { e: EntrepreneurProfile | null; onSaved?: () => Promise<void> | void }) {
  const [options, setOptions] = useState<Record<string, string[]>>({});
  const [editing, setEditing] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const contactId = e?.founderContactId ?? null;
  // Option lists for the pickers: the same cached list the Sales Hub contact page uses.
  useEffect(() => {
    if (!contactId) return;
    let active = true;
    fetch("/api/sales/contacts/field-options").then((r) => (r.ok ? r.json() : null)).then((d) => { if (active && d?.options) setOptions(d.options as Record<string, string[]>); }).catch(() => {});
    return () => { active = false; };
  }, [contactId]);
  if (!e) return <p className="text-[12.5px] text-slate-400">No founder company linked to this project.</p>;
  const o = e.odoo;
  const optionsFor = (key: string) => { const t = key.trim().toLowerCase(); const k = Object.keys(options).find((x) => x.trim().toLowerCase() === t); return k ? options[k] : []; };
  // Saves one field to the founder contact's overrides (the contact page's own PATCH), then reloads.
  async function save(key: string, values: string[]) {
    if (!contactId) return;
    setErr(null);
    const r = await fetch(`/api/sales/contacts/${contactId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ preferences: { [key]: values } }) }).catch(() => null);
    if (!r || !r.ok) { const j = r ? await r.json().catch(() => ({})) : {}; setErr(j.error ?? "Couldn't save that field. Try again."); return; }
    setEditing(null); setSaved(key);
    window.setTimeout(() => setSaved((s) => (s === key ? null : s)), 2500);
    await onSaved?.();
  }
  const rowProps = (r: ProfileRow) => ({
    row: r,
    canEdit: !!contactId && !!r.saveKey,
    editing: editing === r.saveKey,
    saved: saved === r.saveKey,
    options: r.saveKey && r.kind === "list" ? optionsFor(r.saveKey) : [],
    onOpen: () => { if (r.saveKey) { setErr(null); setEditing(r.saveKey); } },
    onCancel: () => setEditing(null),
    onSave: (values: string[]) => (r.saveKey ? save(r.saveKey, values) : Promise.resolve()),
  });
  return (
    <div className="text-[12.5px]">
      <div className="grid gap-x-8 gap-y-0 sm:grid-cols-2">
        <Row label="Company" value={e.company} /><Row label="Founder" value={e.founder} />
        <Row label="Membership type" value={e.membershipType} /><Row label="Member portal plan" value={e.portalPlan} />
        <Row label="Raise" value={e.raise} /><Row label="Stage" value={e.stage} />
        <Row label="Industry" value={e.industry} />
        {e.website ? <div className="flex gap-3 py-1"><span className="w-36 shrink-0 text-slate-500">Website</span><a href={e.website.startsWith("http") ? e.website : `https://${e.website}`} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate text-indigo-700 hover:underline">{e.website.replace(/^https?:\/\//, "").replace(/\/$/, "")}</a></div> : null}
      </div>
      {o ? (
        <>
          {err ? <p className="mt-3 rounded-md bg-rose-50 px-3 py-2 text-[12px] text-rose-700">{err}</p> : null}
          {o.sections.map((sec) => (
            <section key={sec.title} className="mt-4">
              <h4 className="mb-1 border-b border-slate-200 pb-1.5 text-[11.5px] font-bold uppercase tracking-wide text-slate-800">{sec.title}</h4>
              <div className="grid gap-x-8 sm:grid-cols-2">
                {sec.rows.filter((r) => !r.long).map((r) => <EditableOdooRow key={r.label} {...rowProps(r)} />)}
              </div>
              {sec.rows.filter((r) => r.long).map((r) => <EditableOdooRow key={r.label} {...rowProps(r)} />)}
            </section>
          ))}
          <p className="mt-3 text-[11.5px] text-slate-400">
            {contactId ? "Click any field to edit it. Changes save to the founder's " : o.hasQuestionnaire ? "From the founder's Odoo contact" : "The founder hasn't filled in the Odoo entrepreneur questionnaire"}
            {contactId ? <Link href={`/admin/sales/contacts/${contactId}`} className="text-indigo-700 hover:underline">Sales contact</Link> : null}
            {e.syncedAt ? `${contactId ? "; Odoo" : ","} synced ${new Date(e.syncedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}` : ""}.
          </p>
        </>
      ) : null}
      <div className="mt-2 flex gap-4">
        {e.companyId ? <Link href={`/admin/companies/${e.companyId}`} className="text-indigo-700 hover:underline">Open company →</Link> : null}
        {e.founderContactId && !o ? <Link href={`/admin/sales/contacts/${e.founderContactId}`} className="text-indigo-700 hover:underline">Founder in Sales →</Link> : null}
      </div>
    </div>
  );
}

const asValues = (v: string | string[] | null): string[] => (Array.isArray(v) ? v : v ? [v] : []);

/** One questionnaire answer. Click to edit in place: chips with the field's options for
 *  list fields, a text box for written answers. Clicking away or Enter saves; Esc cancels. */
function EditableOdooRow({ row, canEdit, editing, saved, options, onOpen, onCancel, onSave }: {
  row: ProfileRow; canEdit: boolean; editing: boolean; saved: boolean; options: string[];
  onOpen: () => void; onCancel: () => void; onSave: (values: string[]) => Promise<void>;
}) {
  const original = asValues(row.value);
  const [chips, setChips] = useState<string[]>(original);
  const [draft, setDraft] = useState("");
  const [text, setText] = useState(row.kind === "text" ? original.join("\n") : "");
  const [busy, setBusy] = useState(false);
  const [all, setAll] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const originalKey = original.join("\u0001");
  // Seed the editor from the saved value each time the field is opened.
  function open() {
    setChips(original); setDraft(""); setText(row.kind === "text" ? original.join("\n") : "");
    onOpen();
  }

  async function commit() {
    if (busy) return;
    const next = row.kind === "text" ? (text.trim() ? [text.trim()] : []) : [...chips, ...(draft.trim() ? [draft.trim()] : [])];
    const unique = next.filter((v, i) => next.findIndex((x) => x.toLowerCase() === v.toLowerCase()) === i);
    if (unique.join("\u0001") === originalKey) { onCancel(); return; }
    setBusy(true);
    try { await onSave(unique); } finally { setBusy(false); }
  }
  function addChip(v: string) {
    const t = v.trim();
    if (t && !chips.some((c) => c.toLowerCase() === t.toLowerCase())) setChips((c) => [...c, t]);
    setDraft("");
  }
  const onBlur = (ev: React.FocusEvent) => { if (!boxRef.current?.contains(ev.relatedTarget as Node | null)) void commit(); };
  const suggestions = options.filter((op) => !chips.some((c) => c.toLowerCase() === op.toLowerCase()) && (!draft || op.toLowerCase().includes(draft.toLowerCase()))).slice(0, 8);
  const longText = row.long ? original.join("\n") : "";
  const clip = row.long && longText.length > 320;

  return (
    <div className="grid grid-cols-[minmax(0,190px)_1fr] gap-3 py-1.5">
      <span className="pt-0.5 text-slate-600">{row.label}</span>
      {editing ? (
        <div ref={boxRef} onBlur={onBlur} onKeyDown={(ev) => { if (ev.key === "Escape") { ev.preventDefault(); onCancel(); } }} className="relative min-w-0">
          {row.kind === "text" ? (
            <textarea autoFocus value={text} disabled={busy} rows={row.long ? 6 : 2}
              onChange={(ev) => setText(ev.target.value)}
              onKeyDown={(ev) => { if (ev.key === "Enter" && !ev.shiftKey && !row.long) { ev.preventDefault(); void commit(); } }}
              className="w-full rounded-md border-2 border-indigo-400 px-2 py-1 text-[12.5px] text-slate-800 focus:outline-none" />
          ) : (
            <>
              <div className="flex min-h-[30px] flex-wrap items-center gap-1 rounded-md border-2 border-indigo-400 bg-white px-1.5 py-1">
                {chips.map((c) => (
                  <span key={c} className="inline-flex items-center rounded-full bg-indigo-50 px-2 py-0.5 text-[11.5px] text-indigo-700">
                    {c}<button type="button" aria-label={`Remove ${c}`} onClick={() => setChips((x) => x.filter((y) => y !== c))} className="ml-1 text-indigo-400 hover:text-rose-600">×</button>
                  </span>
                ))}
                <input autoFocus value={draft} disabled={busy} placeholder={chips.length ? "" : "Type to add…"}
                  onChange={(ev) => setDraft(ev.target.value)}
                  onKeyDown={(ev) => {
                    if (ev.key === "Enter") { ev.preventDefault(); if (draft.trim()) addChip(suggestions[0] && suggestions[0].toLowerCase().startsWith(draft.toLowerCase()) ? suggestions[0] : draft); else void commit(); }
                    else if (ev.key === "Backspace" && !draft && chips.length) setChips((x) => x.slice(0, -1));
                  }}
                  className="min-w-[90px] flex-1 border-0 bg-transparent px-1 py-0.5 text-[12.5px] focus:outline-none" />
              </div>
              {suggestions.length ? (
                <div className="absolute left-0 right-0 z-20 mt-1 max-h-56 overflow-auto rounded-md border border-slate-200 bg-white py-1 shadow-lg">
                  {suggestions.map((op) => <button key={op} type="button" onMouseDown={(ev) => ev.preventDefault()} onClick={() => addChip(op)} className="block w-full px-2.5 py-1 text-left text-[12.5px] text-slate-700 hover:bg-indigo-50">{op}</button>)}
                </div>
              ) : null}
            </>
          )}
          <p className="mt-0.5 text-[11px] text-slate-400">{busy ? "Saving…" : row.kind === "text" && row.long ? "Click away to save · Esc to cancel" : "Enter or click away to save · Esc to cancel"}</p>
        </div>
      ) : (
        <div role={canEdit ? "button" : undefined} tabIndex={canEdit ? 0 : undefined}
          onClick={canEdit ? open : undefined}
          onKeyDown={canEdit ? (ev) => { if (ev.key === "Enter") { ev.preventDefault(); open(); } } : undefined}
          title={canEdit ? "Click to edit" : undefined}
          className={`group min-w-0 rounded-md px-1 -mx-1 ${canEdit ? "cursor-text hover:bg-slate-50" : ""}`}>
          {row.long ? (
            <span className={`whitespace-pre-line ${longText ? "text-slate-800" : "text-slate-400"}`}>
              {longText ? (all || !clip ? longText : `${longText.slice(0, 320).trimEnd()}…`) : "—"}
              {clip ? <button type="button" onClick={(ev) => { ev.stopPropagation(); setAll((a) => !a); }} className="ml-2 text-[12px] text-indigo-700 hover:underline">{all ? "Show less" : "Show all"}</button> : null}
            </span>
          ) : Array.isArray(row.value) && row.kind === "list" ? (
            <span className="inline-flex flex-wrap gap-1">{row.value.map((v) => <span key={v} className="rounded-full bg-indigo-50 px-2 py-0.5 text-[11.5px] text-indigo-700">{v}</span>)}</span>
          ) : (
            <span className={`break-words whitespace-pre-line ${original.length ? "text-slate-800" : "text-slate-400"}`}>{original.length ? original.join("\n") : "—"}</span>
          )}
          {canEdit ? <span aria-hidden="true" className="ml-1.5 text-[11px] text-slate-300 opacity-0 group-hover:opacity-100">✎</span> : null}
          {saved ? <span className="ml-2 text-[11px] text-emerald-600">✓ Saved</span> : null}
        </div>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string | null }) {
  return <div className="flex gap-3 py-1"><span className="w-36 shrink-0 text-slate-500">{label}</span><span className={`min-w-0 flex-1 ${value ? "text-slate-800" : "text-slate-400"}`}>{value ?? "—"}</span></div>;
}

export function MessageComposer({ endpoint, onSent }: { endpoint: string; onSent: () => Promise<void> }) {
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  async function send() {
    if (!body.trim()) { setErr("Write the message."); return; }
    setBusy(true); setErr(null); setOk(null);
    const r = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "message", body: body.trim() }) });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) { setErr(j.error ?? "Couldn't send."); return; }
    setBody(""); setOk(j.notified ? `Sent — ${j.notified} follower${j.notified === 1 ? "" : "s"} notified.` : "Sent and kept on the record.");
    await onSent();
  }
  return (
    <div>
      <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={3} placeholder="Message to followers — the project owner and the assignee get a notification; the message stays on this record." className={`w-full ${inp}`} />
      <div className="mt-2 flex items-center gap-3">
        {err ? <span className="text-[12px] text-rose-600">{err}</span> : null}{ok ? <span className="text-[12px] text-emerald-700">{ok}</span> : null}
        <button type="button" disabled={busy} onClick={send} className="ml-auto rounded-lg bg-indigo-600 px-3.5 py-1.5 text-[12.5px] font-semibold text-white hover:bg-indigo-700 disabled:opacity-60">{busy ? "Sending…" : "Send"}</button>
      </div>
    </div>
  );
}
