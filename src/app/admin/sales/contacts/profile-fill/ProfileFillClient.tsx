"use client";

/**
 * Review profile fill: one contact at a time, Odoo pager across everyone with proposals.
 * Each row shows the proposed value, its label (LinkedIn, Found with the source, Guess with
 * the reason) and what the contact holds now. Nothing saves until "Accept checked".
 */
import { useEffect, useMemo, useState } from "react";
import { OdooPager } from "@/components/admin/OdooPager";

type Label = "linkedin" | "found" | "guess";
type Row = {
  id: string; field: string; fieldLabel: string; value: string | string[]; label: Label;
  sourceUrl: string | null; basis: string | null; confidence: string | null; current: string | null; lands: string | null;
};
type Item = { contact: { id: string; name: string; company: string | null; title: string | null; email: string | null; phone: string | null; website: string | null; linkedin: string | null }; rows: Row[] };
type Queue = { queue: Array<{ contactId: string; pending: number }>; stats: { pendingContacts: number; pendingProposals: number; accepted: number } };

const BLUE = "#2E78F5";
const TAG: Record<Label, { text: string; bg: string; fg: string }> = {
  linkedin: { text: "LinkedIn", bg: "#E6F1FB", fg: "#0C447C" },
  found: { text: "Found", bg: "#EAF3DE", fg: "#27500A" },
  guess: { text: "Guess", bg: "#FAEEDA", fg: "#633806" },
};

function Btn({ children, primary, ...p }: React.ButtonHTMLAttributes<HTMLButtonElement> & { primary?: boolean }) {
  return <button type="button" {...p} style={{ fontSize: 12.5, fontWeight: primary ? 600 : 400, color: primary ? "#fff" : "var(--foreground)", background: primary ? BLUE : "#fff", border: primary ? "none" : "0.5px solid #cdd9ec", borderRadius: 8, padding: "7px 14px", cursor: p.disabled ? "default" : "pointer", opacity: p.disabled ? 0.55 : 1, ...p.style }}>{children}</button>;
}

const show = (v: string | string[]) => (Array.isArray(v) ? v.join(", ") : v);
const hostOf = (u: string) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return u; } };

export function ProfileFillClient() {
  const [group, setGroup] = useState<"investor" | "all">("investor");
  const [q, setQ] = useState<Queue | null>(null);
  const [pos, setPos] = useState(0);
  const [item, setItem] = useState<Item | null>(null);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let alive = true;
    fetch(`/api/sales/contacts/profile-fill?group=${group}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((j: Queue & { error?: string }) => { if (!alive) return; if (j.error) setMsg({ ok: false, text: j.error }); else setQ(j); })
      .catch(() => undefined);
    return () => { alive = false; };
  }, [group, reload]);

  const total = q?.queue.length ?? 0;
  // A decided contact leaves the queue; stay on the same position, clamped to the end.
  const idx = Math.min(pos, Math.max(0, total - 1));
  const current = q?.queue[idx]?.contactId ?? null;
  useEffect(() => {
    if (!current) return;
    let alive = true;
    fetch(`/api/sales/contacts/profile-fill?id=${current}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((j: Item & { error?: string }) => {
        if (!alive) return;
        if (j.error) { setMsg({ ok: false, text: j.error }); return; }
        setItem(j);
        // Found and LinkedIn values start checked; guesses wait for a person to tick them.
        setChecked(Object.fromEntries(j.rows.map((r) => [r.id, r.label !== "guess"])));
        setEdits({});
      })
      .catch(() => undefined);
    return () => { alive = false; };
  }, [current]);

  const shownItem = current && item?.contact.id === current ? item : null;
  const anyChecked = useMemo(() => Object.values(checked).some(Boolean), [checked]);

  async function act(accept: boolean) {
    if (!shownItem) return;
    const rows = shownItem.rows.filter((r) => checked[r.id]);
    if (!rows.length) return;
    setBusy(true); setMsg(null);
    try {
      const res = await fetch("/api/sales/contacts/profile-fill", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "decide", contactId: shownItem.contact.id, decisions: rows.map((r) => ({ id: r.id, accept, ...(edits[r.id] !== undefined ? { value: edits[r.id] } : {}) })) }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "Could not save.");
      const parts = [accept ? `${j.accepted} saved to the contact` : `${j.rejected} rejected`];
      if (j.failed?.length) parts.push(`${j.failed.length} could not be saved: ${j.failed.map((f: { field: string; message: string }) => `${f.field} (${f.message})`).join("; ")}`);
      if (j.odooNotes?.length) parts.push(`Odoo: ${j.odooNotes.join("; ")}`);
      setMsg({ ok: !j.failed?.length, text: parts.join(". ") + "." });
      const left = shownItem.rows.filter((r) => !rows.some((x) => x.id === r.id));
      if (left.length) {
        setItem({ ...shownItem, rows: left });
      } else {
        // Everything decided: this contact leaves the queue; stay on the same position.
        setReload((n) => n + 1);
      }
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : "Could not save." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-3">
      <div className="flex flex-wrap items-center gap-2.5 border-b border-slate-200 pb-3">
        <h1 className="text-[15px] font-semibold text-slate-900">Review profile fill</h1>
        <select value={group} onChange={(e) => { setGroup(e.target.value as "investor" | "all"); setPos(0); }} className="rounded-md border border-slate-300 px-2 py-1 text-[12.5px]">
          <option value="investor">Investors</option>
          <option value="all">All LinkedIn contacts</option>
        </select>
        {q ? <span className="text-[12px] text-slate-500">{q.stats.pendingProposals.toLocaleString("en-US")} proposals waiting · {q.stats.accepted.toLocaleString("en-US")} accepted so far</span> : null}
        <span className="ml-auto">
          <OdooPager
            label={total ? `${idx + 1} / ${total.toLocaleString("en-US")}` : "0 / 0"}
            prev={{ onClick: () => setPos(Math.max(0, idx - 1)), disabled: idx <= 0 }}
            next={{ onClick: () => setPos(Math.min(total - 1, idx + 1)), disabled: idx >= total - 1 }}
          />
        </span>
      </div>

      <p className="mt-2 text-[12px] text-slate-500">
        Drafted from the LinkedIn export and the firm&apos;s published pages. Nothing saves until you accept it. Guesses are labelled, start unticked, and matching ignores them until accepted. Emails are never guessed.
      </p>
      {msg ? <p className={`mt-2 rounded-md px-3 py-2 text-[12.5px] ${msg.ok ? "bg-emerald-50 text-emerald-800" : "bg-rose-50 text-rose-800"}`}>{msg.text}</p> : null}

      {q && total === 0 ? (
        <div className="py-14 text-center">
          <p className="text-sm font-medium text-slate-800">Nothing waiting for review</p>
          <p className="mt-1 text-sm text-slate-500">Load the research file or run the person search in step 4 of the LinkedIn import.</p>
        </div>
      ) : null}

      {shownItem ? (
        <div className="mt-3 rounded-xl border border-slate-200 bg-white">
          <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 px-4 py-3">
            <a href={`/admin/sales/contacts/${shownItem.contact.id}`} className="text-[15px] font-semibold text-slate-900 hover:underline">{shownItem.contact.name}</a>
            {shownItem.contact.linkedin ? <a href={shownItem.contact.linkedin} target="_blank" rel="noreferrer" className="rounded px-1.5 text-[11px] font-medium" style={{ background: TAG.linkedin.bg, color: TAG.linkedin.fg }}>LinkedIn</a> : null}
            <span className="text-[12.5px] text-slate-500">{[shownItem.contact.title, shownItem.contact.company].filter(Boolean).join(" · ")}</span>
          </div>
          <div className="divide-y divide-slate-100">
            {shownItem.rows.map((r) => (
              <div key={r.id} className="grid grid-cols-[22px_140px_minmax(0,1fr)] gap-x-3 px-4 py-3 sm:grid-cols-[22px_150px_minmax(0,1fr)_220px]">
                <input type="checkbox" className="mt-1" checked={Boolean(checked[r.id])} onChange={(e) => setChecked((c) => ({ ...c, [r.id]: e.target.checked }))} aria-label={`Select ${r.fieldLabel}`} />
                <div className="text-[12.5px] text-slate-500">{r.fieldLabel}</div>
                <div className="min-w-0 text-[13px] text-slate-900">
                  {r.field === "bio" || r.field === "company_summary" ? (
                    <textarea
                      value={edits[r.id] ?? show(r.value)}
                      onChange={(e) => setEdits((x) => ({ ...x, [r.id]: e.target.value }))}
                      rows={3}
                      className="w-full rounded-md border border-slate-200 px-2 py-1.5 text-[13px]"
                    />
                  ) : (
                    <span>{show(r.value)}</span>
                  )}
                  {r.current ? <p className="mt-0.5 text-[11.5px] text-slate-400">Now: {r.current}</p> : null}
                  {r.lands ? <p className="mt-0.5 text-[11.5px] text-slate-400">{r.lands}</p> : null}
                </div>
                <div className="col-span-3 mt-1.5 text-[11.5px] sm:col-span-1 sm:mt-0">
                  <span className="rounded px-1.5 py-0.5 font-medium" style={{ background: TAG[r.label].bg, color: TAG[r.label].fg }}>{TAG[r.label].text}</span>
                  {r.sourceUrl ? <a href={r.sourceUrl} target="_blank" rel="noreferrer" className="ml-1.5 text-blue-700 hover:underline">{hostOf(r.sourceUrl)}</a> : null}
                  {r.basis ? <p className="mt-1 text-slate-500">{r.basis}</p> : null}
                </div>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2 border-t border-slate-200 px-4 py-3">
            <button type="button" className="text-[12px] text-slate-500 hover:text-slate-800" onClick={() => setChecked(Object.fromEntries(shownItem.rows.map((r) => [r.id, true])))}>Tick all</button>
            <button type="button" className="text-[12px] text-slate-500 hover:text-slate-800" onClick={() => setChecked({})}>Untick all</button>
            <span className="ml-auto" />
            <Btn disabled={busy || !anyChecked} onClick={() => act(false)}>Reject checked</Btn>
            <Btn primary disabled={busy || !anyChecked} onClick={() => act(true)}>Accept checked</Btn>
          </div>
        </div>
      ) : current ? <p className="py-10 text-sm text-slate-500">Loading…</p> : null}
    </div>
  );
}
