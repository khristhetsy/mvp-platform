"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Message = { subject: string; intro: string; closing: string };

const DEFAULT_MESSAGE: Message = {
  subject: "{{company}} — a Founder Preview that fits your focus",
  intro: "Hi {{investor}},\n\nOur fit scoring matched {{company}} to your stated preferences. Here's their Founder Preview — no obligation.",
  closing: "If it's a fit, simply reply and we'll make the introduction. If not, no action is needed.",
};

const MERGE_FIELDS = ["{{company}}", "{{investor}}", "{{stage}}", "{{sector}}"];

/**
 * Admin editor for the outreach email copy ("What the investor receives").
 * Subject / intro / closing are editable with merge fields; the one-pager card
 * and the legal disclaimer are fixed and added at send time.
 */
export function OutreachMessageEditor() {
  const [msg, setMsg] = useState<Message | null>(null);
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState<{ text: string; ok: boolean } | null>(null);
  const introRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/admin/investor-outreach")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (active && d?.message) setMsg(d.message as Message); })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  const save = useCallback(async (next: Message) => {
    setMsg(next);
    setSaving(true);
    setNote(null);
    try {
      const res = await fetch("/api/admin/investor-outreach", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "set_message", config: next }),
      });
      setNote(res.ok ? { text: "Saved.", ok: true } : { text: "Couldn't save.", ok: false });
    } catch {
      setNote({ text: "Network error.", ok: false });
    } finally {
      setSaving(false);
    }
  }, []);

  if (!msg) return null;

  const insertToken = (token: string) => {
    const el = introRef.current;
    if (!el) { setMsg({ ...msg, intro: `${msg.intro}${token}` }); return; }
    const start = el.selectionStart ?? msg.intro.length;
    const end = el.selectionEnd ?? msg.intro.length;
    const next = msg.intro.slice(0, start) + token + msg.intro.slice(end);
    setMsg({ ...msg, intro: next });
    requestAnimationFrame(() => { el.focus(); el.selectionStart = el.selectionEnd = start + token.length; });
  };

  const field = "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm";

  return (
    <section className="rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">What the investor receives</h2>
          <p className="mt-0.5 text-xs text-slate-500">Edit the intro. The one-pager card and disclaimer are inserted automatically at send time.</p>
        </div>
        <span className="rounded-md bg-indigo-50 px-2 py-0.5 text-[11px] font-medium text-indigo-700">Editable</span>
      </div>

      <label className="mt-3 block text-[13px] text-slate-700">
        Subject
        <input value={msg.subject} onChange={(e) => setMsg({ ...msg, subject: e.target.value })} onBlur={() => save(msg)} className={`mt-1 ${field}`} />
      </label>

      <div className="mt-3">
        <div className="flex items-center justify-between">
          <span className="text-[13px] text-slate-700">Message</span>
          <span className="flex flex-wrap gap-1.5">
            {MERGE_FIELDS.map((f) => (
              <button key={f} type="button" onClick={() => insertToken(f)} className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600 hover:bg-slate-200">+ {f}</button>
            ))}
          </span>
        </div>
        <textarea ref={introRef} value={msg.intro} onChange={(e) => setMsg({ ...msg, intro: e.target.value })} onBlur={() => save(msg)} rows={4} className={`mt-1 ${field} leading-6`} />
      </div>

      <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50/70 p-3">
        <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Auto-inserted · one-pager card</div>
        <div className="mt-2 flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-xs font-semibold text-indigo-800">D</div>
          <div><div className="text-[13px] font-medium text-slate-800">Docuverse</div><div className="text-[11px] text-slate-500">AI document workflows for legal teams</div></div>
        </div>
        <a href="/f/docuverse" target="_blank" rel="noopener noreferrer" className="mt-2.5 inline-block rounded-md bg-blue-600 px-3 py-1.5 text-[11.5px] font-semibold text-white hover:bg-blue-700">View full one-pager →</a>
        <span className="ml-2 text-[10.5px] text-slate-400">links to <code>/f/&lt;slug&gt;</code> — the founder&apos;s published one-pager</span>
      </div>

      <label className="mt-3 block text-[13px] text-slate-700">
        Closing line
        <textarea value={msg.closing} onChange={(e) => setMsg({ ...msg, closing: e.target.value })} onBlur={() => save(msg)} rows={2} className={`mt-1 ${field} leading-6`} />
      </label>

      <p className="mt-3 flex items-center gap-1.5 border-t border-slate-100 pt-3 text-[10.5px] leading-5 text-slate-400">
        <span aria-hidden="true">🔒</span> Locked footer — introduction generated from platform fit scoring; not investment advice or a solicitation. Every send includes an unsubscribe link.
      </p>

      <div className="mt-3 flex items-center gap-3">
        <button type="button" onClick={() => save(msg)} disabled={saving} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-60">
          {saving ? "Saving…" : "Save message"}
        </button>
        <button type="button" onClick={() => save(DEFAULT_MESSAGE)} disabled={saving} className="text-[13px] font-medium text-slate-500 hover:text-slate-800">Reset to default</button>
        {note ? <span className={`text-xs ${note.ok ? "text-emerald-700" : "text-red-600"}`}>{note.text}</span> : null}
      </div>
    </section>
  );
}
