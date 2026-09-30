"use client";

import Link from "next/link";
import { useRef, useState } from "react";

type Role = "founder" | "investor";
type Step = "contact" | "website" | "guess";
type GuessField = { field: string; label: string; default: boolean };
type Item = { contactId: string; name: string | null; company: string | null; field: string; label: string; values: string[]; tag: string; previous?: { values: string[]; tag: string | null } };
type Preview = { contacts: number; scanned: number; byField: Record<string, number>; sample: Item[]; sampled?: number; unreadable?: number; aiError?: string; error?: string };
type Apply = { scanned: number; contacts: number; fields: number; byField: Record<string, number>; errors: number; unreadable?: number; nextCursor: string | null; done: boolean; aiError?: string; error?: string };

const TOTAL: Record<Role, string> = { founder: "Founders", investor: "Investors" };

const STEP_INFO: Record<Step, { title: string; note: string; fills: Record<Role, string> }> = {
  contact: {
    title: "Step 1 · Contact data",
    note: "free, instant, run this first",
    fills: {
      founder: "Website from a company email domain (never Gmail or other free mail). Country from an international phone number. LinkedIn from the website column or anywhere in the Odoo record.",
      investor: "Website from a company email domain (never Gmail or other free mail). Country from an international phone number. LinkedIn from the website column or anywhere in the Odoo record.",
    },
  },
  website: {
    title: "Step 2 · Website read",
    note: "reads home, /about and /team, then AI over the text",
    fills: {
      founder: "LinkedIn link on the site. Business summary from the site's own description, else AI. Industry by AI, also replacing a low guess when the site reads medium or better. Management team named on the site.",
      investor: "LinkedIn link on the site. Business summary from the site's own description, else AI. Industry by AI where blank, also replacing a low guess when the site reads medium or better.",
    },
  },
  guess: {
    title: "Step 3 · Same-type guess",
    note: "majority of 30+ stated answers",
    fills: {
      founder: "Grouped by funding stage. A value is used only when at least half of the founders in the group who stated the field chose it.",
      investor: "Grouped by investor type. A value is used only when at least half of the investors of that type who stated the field chose it.",
    },
  },
};

const NEVER = "Never filled: email, phone, how they heard about us, referral, iCFO capital partner, assigned agent, contact preference, internal notes. Industry is never guessed.";

function tagStyle(tag: string): string {
  if (/^(derived|site|stated)/.test(tag)) return "bg-emerald-50 text-emerald-800 border-emerald-200";
  if (/^inferred:(high|medium)/.test(tag)) return "bg-sky-50 text-sky-800 border-sky-200";
  return "bg-amber-50 text-amber-800 border-amber-200";
}

function cursorKey(role: Role, step: Step) { return `contacts-fill:${role}:${step}`; }
function readCursor(role: Role, step: Step): string | null { try { return localStorage.getItem(cursorKey(role, step)); } catch { return null; } }
function writeCursor(role: Role, step: Step, v: string | null) { try { if (v) localStorage.setItem(cursorKey(role, step), v); else localStorage.removeItem(cursorKey(role, step)); } catch { /* per-viewer convenience only */ } }

async function post<T>(body: unknown): Promise<T> {
  const res = await fetch("/api/admin/contacts/fill-missing", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const d = await res.json().catch(() => ({ error: "Bad response." }));
  if (!res.ok) throw new Error(d.error ?? `Request failed (${res.status}).`);
  return d as T;
}

export function FillMissingClient({ fields }: { fields: Record<Role, GuessField[]> }) {
  const [role, setRole] = useState<Role>("founder");
  const [guess, setGuess] = useState<Record<Role, string[]>>({
    founder: fields.founder.filter((f) => f.default).map((f) => f.field),
    investor: fields.investor.filter((f) => f.default).map((f) => f.field),
  });
  const [preview, setPreview] = useState<Partial<Record<Step, Preview>>>({});
  const [msg, setMsg] = useState<Partial<Record<Step, string>>>({});
  const [busy, setBusy] = useState<Step | null>(null);
  const stop = useRef(false);

  function switchRole(r: Role) {
    setRole(r); setPreview({}); setMsg({});
  }

  const say = (s: Step, m: string) => setMsg((p) => ({ ...p, [s]: m }));

  async function runPreview(s: Step) {
    setBusy(s); say(s, s === "website" ? "Scanning, then reading a few sites…" : "Scanning…");
    try {
      const d = await post<Preview>({ op: "preview", role, step: s, guessFields: guess[role] });
      setPreview((p) => ({ ...p, [s]: d }));
      say(s, d.aiError ? `AI unavailable: ${d.aiError}` : "");
    } catch (e) { say(s, e instanceof Error ? e.message : "Preview failed."); } finally { setBusy(null); }
  }

  async function runApply(s: Step) {
    setBusy(s); stop.current = false;
    let after = readCursor(role, s);
    let contacts = 0, fieldsN = 0, errors = 0, fails = 0, guard = 0;
    const byField: Record<string, number> = {};
    while (guard++ < 5000) {
      if (stop.current) { say(s, `Stopped. ${contacts.toLocaleString()} contacts, ${fieldsN.toLocaleString()} fields filled. Apply again to continue from here.`); break; }
      try {
        const d = await post<Apply>({ op: "apply", role, step: s, afterId: after ?? undefined, guessFields: guess[role] });
        if (d.aiError) { say(s, `Paused: AI unavailable (${d.aiError}). ${contacts.toLocaleString()} contacts filled so far. Apply again to continue.`); break; }
        fails = 0; contacts += d.contacts; fieldsN += d.fields; errors += d.errors;
        for (const [k, v] of Object.entries(d.byField)) byField[k] = (byField[k] ?? 0) + v;
        after = d.nextCursor; writeCursor(role, s, d.done ? null : after);
        say(s, `Working… ${contacts.toLocaleString()} contacts, ${fieldsN.toLocaleString()} fields filled${errors ? `, ${errors} errors` : ""}.`);
        if (d.done) {
          say(s, `Done. ${contacts.toLocaleString()} contacts, ${fieldsN.toLocaleString()} fields filled${errors ? `, ${errors} errors` : ""}. ${Object.entries(byField).map(([k, v]) => `${k} ${v.toLocaleString()}`).join(" · ")}`);
          break;
        }
      } catch (e) {
        if (++fails >= 3) { say(s, `Paused after repeated errors (${e instanceof Error ? e.message : "request failed"}). Apply again to continue.`); break; }
        await new Promise((r) => setTimeout(r, 1500));
      }
    }
    setBusy(null);
  }

  async function runUndo(s: Step) {
    setBusy(s); say(s, "Undoing…");
    try {
      const d = await post<{ removed: number }>({ op: "undo", role, step: s });
      writeCursor(role, s, null); setPreview((p) => ({ ...p, [s]: undefined }));
      say(s, `Removed what this step wrote from ${d.removed.toLocaleString()} contacts.`);
    } catch (e) { say(s, e instanceof Error ? e.message : "Undo failed."); } finally { setBusy(null); }
  }

  const labelOf = (field: string) => ({ website: "Website", country: "Country", linkedin: "LinkedIn", summary: "Business summary", industry: "Industry", team: "Management team" } as Record<string, string>)[field]
    ?? fields[role].find((f) => f.field === field)?.label ?? field;

  return (
    <div>
      <div className="mb-4 flex items-center gap-2">
        {(["founder", "investor"] as Role[]).map((r) => (
          <button key={r} type="button" onClick={() => switchRole(r)} disabled={busy !== null}
            className={`rounded-lg border px-3.5 py-1.5 text-[13px] font-medium disabled:opacity-50 ${role === r ? "border-slate-800 bg-slate-800 text-white" : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"}`}>
            {TOTAL[r]}
          </button>
        ))}
        <span className="ml-auto text-[11.5px] text-slate-500">A value from a higher step is never replaced by a lower one.</span>
      </div>

      {(["contact", "website", "guess"] as Step[]).map((s) => {
        const p = preview[s];
        const info = STEP_INFO[s];
        return (
          <div key={s} className="mb-4 rounded-xl border border-slate-200 bg-slate-50 p-3.5">
            <div className="text-[13px] font-semibold text-slate-800">{info.title} <span className="font-normal text-slate-500">· {info.note}</span></div>
            <p className="mt-1 text-[11.5px] text-slate-500">{info.fills[role]}</p>

            {s === "guess" ? (
              <div className="mt-2.5 overflow-hidden rounded-lg border border-slate-200 bg-white">
                <div className="grid grid-cols-[minmax(0,1fr)_90px_70px] gap-2 border-b border-slate-200 bg-slate-50 px-3 py-1.5 text-[11px] font-medium text-slate-500"><span>Field</span><span>Would fill</span><span>Guess</span></div>
                {fields[role].map((f) => (
                  <label key={f.field} className="grid cursor-pointer grid-cols-[minmax(0,1fr)_90px_70px] items-center gap-2 border-b border-slate-100 px-3 py-1.5 text-[12.5px] last:border-b-0">
                    <span className="text-slate-800">{f.label}{f.default ? "" : <span className="ml-1.5 text-[11px] text-amber-700">off by default</span>}</span>
                    <span className="text-slate-600">{p ? (p.byField[f.field] ?? 0).toLocaleString() : "·"}</span>
                    <input type="checkbox" checked={guess[role].includes(f.field)} disabled={busy !== null}
                      onChange={(e) => { setGuess((g) => ({ ...g, [role]: e.target.checked ? [...g[role], f.field] : g[role].filter((x) => x !== f.field) })); setPreview((x) => ({ ...x, guess: undefined })); }} />
                  </label>
                ))}
              </div>
            ) : null}

            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              <button type="button" onClick={() => void runPreview(s)} disabled={busy !== null} className="rounded-lg border border-indigo-300 bg-white px-3.5 py-2 text-[13px] font-medium text-indigo-700 hover:bg-indigo-50 disabled:opacity-50">⌕ Preview</button>
              {p && p.contacts > 0 ? (
                <button type="button" onClick={() => void runApply(s)} disabled={busy !== null} className="rounded-lg bg-slate-800 px-3.5 py-2 text-[13px] font-medium text-white hover:bg-slate-900 disabled:opacity-50">
                  ✓ Apply to {p.contacts.toLocaleString()}
                </button>
              ) : null}
              {busy === s ? <button type="button" onClick={() => { stop.current = true; }} className="rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-[13px] text-slate-700 hover:bg-slate-50">Stop</button> : null}
              <button type="button" onClick={() => void runUndo(s)} disabled={busy !== null} className="ml-auto rounded-lg border border-slate-300 bg-white px-3 py-2 text-[12px] text-slate-600 hover:bg-slate-50 disabled:opacity-50">Undo this step</button>
            </div>

            {p ? (
              <div className="mt-2 text-[11.5px] text-slate-600">
                {p.contacts.toLocaleString()} of {p.scanned.toLocaleString()} {TOTAL[role].toLowerCase()} have work for this step
                {Object.keys(p.byField).length ? <> · {Object.entries(p.byField).map(([k, v]) => `${labelOf(k)} ${v.toLocaleString()}`).join(" · ")}</> : null}
                {s === "website" && p.sampled ? <> · sample of {p.sampled} sites read below{p.unreadable ? `, ${p.unreadable} didn't load` : ""}</> : null}
                {s === "website" && p.contacts > 0 ? <div className="mt-1 text-slate-500">Reads about 18 sites per request, so a full run takes hours. Stop any time: Apply picks up where the last run stopped.</div> : null}
              </div>
            ) : null}
            {msg[s] ? <div className="mt-1.5 text-[11.5px] text-slate-600">{msg[s]}</div> : null}

            {p && p.sample.length ? (
              <div className="mt-2.5 overflow-hidden rounded-lg border border-slate-200 bg-white">
                <div className="grid grid-cols-[minmax(0,1fr)_110px_minmax(0,1.6fr)_110px] gap-2 border-b border-slate-200 bg-slate-50 px-3 py-1.5 text-[11px] font-medium text-slate-500"><span>Contact</span><span>Field</span><span>Proposed value</span><span>Tag</span></div>
                {p.sample.slice(0, 25).map((i, n) => (
                  <div key={`${i.contactId}-${i.field}-${n}`} className="grid grid-cols-[minmax(0,1fr)_110px_minmax(0,1.6fr)_110px] items-start gap-2 border-b border-slate-100 px-3 py-1.5 text-[12px] last:border-b-0">
                    <Link href={`/admin/sales/contacts/${i.contactId}`} className="truncate text-slate-800 hover:underline" title={i.company ?? i.name ?? ""}>{i.company || i.name || "Contact"}</Link>
                    <span className="text-slate-600">{labelOf(i.field)}</span>
                    <span className="break-words text-slate-800">{i.values.join(", ")}{i.previous ? <span className="block text-[11px] text-slate-500">replaces {i.previous.values.join(", ") || "blank"} ({i.previous.tag ?? "untagged"})</span> : null}</span>
                    <span><span className={`inline-block rounded border px-1.5 py-0.5 text-[11px] ${tagStyle(i.tag)}`}>{i.tag}</span></span>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        );
      })}

      <p className="text-[11.5px] text-slate-500">{NEVER}</p>
    </div>
  );
}
