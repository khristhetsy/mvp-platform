"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import type { ScheduleQuestion } from "@/lib/scheduling/types";
import {
  FIT_BOOKING_FORM_DEFAULTS, MAX_FIT_QUESTIONS, resolveFitBookingForm,
  type FitBookingForm, type FitContactFields,
} from "@/lib/fit/booking-form-config";

/** Admin › Fit funnel: the fields founders fill in when they book a Match Review from /fit. */
export function FitBookingFormEditor() {
  const [form, setForm] = useState<FitBookingForm>(FIT_BOOKING_FORM_DEFAULTS);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    fetch("/api/fit/booking-form").then((r) => (r.ok ? r.json() : null)).then((d) => {
      if (d?.form) setForm(resolveFitBookingForm(d.form));
    }).catch(() => {}).finally(() => setLoaded(true));
  }, []);

  const cf = form.contactFields;
  const setCf = <K extends keyof FitContactFields>(key: K, patch: Partial<FitContactFields[K]>) => {
    setStatus(null);
    setForm((f) => ({ ...f, contactFields: { ...f.contactFields, [key]: { ...f.contactFields[key], ...patch } } }));
  };
  const setQ = (id: string, patch: Partial<ScheduleQuestion>) => {
    setStatus(null);
    setForm((f) => ({ ...f, questions: f.questions.map((q) => (q.id === id ? { ...q, ...patch } : q)) }));
  };
  const addQ = () => {
    setStatus(null);
    setForm((f) => ({ ...f, questions: [...f.questions, { id: crypto.randomUUID?.() ?? String(Date.now()), label: "", type: "short_text", options: [], required: false }] }));
  };
  const removeQ = (id: string) => {
    setStatus(null);
    setForm((f) => ({ ...f, questions: f.questions.filter((q) => q.id !== id) }));
  };

  async function save() {
    const blank = form.questions.find((q) => !q.label.trim());
    if (blank) { setStatus({ ok: false, text: "Every question needs a label. Fill it in or remove the question." }); return; }
    const noOptions = form.questions.find((q) => q.type !== "short_text" && !q.options.some((o) => o.trim()));
    if (noOptions) { setStatus({ ok: false, text: `Add at least one option to "${noOptions.label}".` }); return; }
    setSaving(true);
    setStatus(null);
    try {
      const res = await fetch("/api/fit/booking-form", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ form }) });
      const d = await res.json().catch(() => null);
      if (!res.ok) { setStatus({ ok: false, text: typeof d?.error === "string" ? d.error : "Couldn't save. Try again." }); return; }
      if (d?.form) setForm(resolveFitBookingForm(d.form));
      setStatus({ ok: true, text: "Saved. /fit uses these fields now." });
    } catch {
      setStatus({ ok: false, text: "Couldn't save. Try again." });
    } finally {
      setSaving(false);
    }
  }

  const input = "h-8 w-full rounded-md border border-[var(--border-subtle)] bg-white px-2 text-[13px] text-[var(--text-primary)] focus:border-indigo-500 focus:outline-none";
  const check = "h-3.5 w-3.5 rounded disabled:opacity-40";

  return (
    <div className="mt-6 rounded-xl border border-[var(--border-subtle)] bg-white p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[15px] font-semibold text-[var(--text-primary)]">Match review booking form</p>
          <p className="mt-0.5 text-[12px] text-[var(--text-muted)]">What founders fill in when they book from /fit.</p>
        </div>
        <button type="button" onClick={save} disabled={!loaded || saving}
          className="rounded-md bg-indigo-600 px-3 py-1.5 text-[13px] font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
      {status ? <p role="status" className={`mt-3 text-[12px] ${status.ok ? "text-emerald-700" : "text-red-700"}`}>{status.text}</p> : null}

      <p className="mt-4 text-[13px] font-semibold text-[var(--text-primary)]">Contact fields</p>
      <table className="mt-2 w-full table-fixed text-[13px]">
        <colgroup><col className="w-[22%]" /><col className="w-[42%]" /><col className="w-[18%]" /><col className="w-[18%]" /></colgroup>
        <thead>
          <tr className="border-b border-[var(--border-subtle)] text-left text-[12px] text-[var(--text-muted)]">
            <th className="py-1.5 font-medium">Field</th><th className="py-1.5 font-medium">Label shown</th><th className="py-1.5 font-medium">Collect</th><th className="py-1.5 font-medium">Required</th>
          </tr>
        </thead>
        <tbody>
          {(["name", "email"] as const).map((k) => (
            <tr key={k} className="border-b border-[var(--border-subtle)]">
              <td className="py-1.5 capitalize text-[var(--text-secondary)]">{k}</td>
              <td className="py-1.5 pr-3"><input aria-label={`${k} label`} maxLength={80} value={cf[k].label} onChange={(e) => setCf(k, { label: e.target.value })} className={input} /></td>
              <td className="py-1.5"><span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-500">Always</span></td>
              <td className="py-1.5"><input type="checkbox" checked disabled aria-label={`${k} required`} className={check} /></td>
            </tr>
          ))}
          {(["phone", "company"] as const).map((k) => (
            <tr key={k} className="border-b border-[var(--border-subtle)] last:border-0">
              <td className="py-1.5 capitalize text-[var(--text-secondary)]">{k}</td>
              <td className="py-1.5 pr-3"><input aria-label={`${k} label`} maxLength={80} value={cf[k].label} onChange={(e) => setCf(k, { label: e.target.value })} className={input} /></td>
              <td className="py-1.5"><input type="checkbox" aria-label={`Collect ${k}`} checked={cf[k].collect} onChange={(e) => setCf(k, { collect: e.target.checked, required: e.target.checked && cf[k].required })} className={check} /></td>
              <td className="py-1.5"><input type="checkbox" aria-label={`${k} required`} checked={cf[k].required} disabled={!cf[k].collect} onChange={(e) => setCf(k, { required: e.target.checked })} className={check} /></td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-1.5 text-[11px] text-[var(--text-muted)]">Name and email are always required: the calendar invite goes to the email.</p>

      <p className="mt-5 text-[13px] font-semibold text-[var(--text-primary)]">Extra questions</p>
      {form.questions.length === 0 ? <p className="mt-1 text-[12px] text-[var(--text-muted)]">No extra questions. Founders only fill in the contact fields.</p> : null}
      <div className="mt-2 flex flex-col gap-2">
        {form.questions.map((q) => (
          <div key={q.id} className="rounded-lg border border-[var(--border-subtle)] p-2.5">
            <div className="flex items-center gap-2">
              <input aria-label="Question" placeholder="What stage is your round at?" maxLength={300} value={q.label} onChange={(e) => setQ(q.id, { label: e.target.value })} className={input} />
              <select aria-label="Answer type" value={q.type} onChange={(e) => {
                const type = e.target.value as ScheduleQuestion["type"];
                setQ(q.id, { type, options: type === "short_text" ? [] : q.options.length ? q.options : ["Option 1"] });
              }} className="h-8 rounded-md border border-[var(--border-subtle)] bg-white px-2 text-[13px]">
                <option value="short_text">Short text</option>
                <option value="single">Single choice</option>
                <option value="multi">Multiple choice</option>
              </select>
              <label className="flex flex-shrink-0 items-center gap-1.5 text-[12px] text-[var(--text-secondary)]">
                <input type="checkbox" checked={q.required} onChange={(e) => setQ(q.id, { required: e.target.checked })} className={check} /> Required
              </label>
              <button type="button" onClick={() => removeQ(q.id)} className="rounded p-1 text-slate-400 hover:text-red-700" aria-label="Remove question"><Trash2 className="h-4 w-4" /></button>
            </div>
            {q.type !== "short_text" ? (
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                {q.options.map((o, i) => (
                  <span key={i} className="flex items-center gap-1 rounded-md border border-[var(--border-subtle)] bg-slate-50 pl-2">
                    <input aria-label={`Option ${i + 1}`} maxLength={120} value={o} onChange={(e) => setQ(q.id, { options: q.options.map((x, j) => (j === i ? e.target.value : x)) })}
                      className="h-7 w-28 bg-transparent text-[12px] focus:outline-none" />
                    <button type="button" aria-label={`Remove option ${i + 1}`} onClick={() => setQ(q.id, { options: q.options.filter((_, j) => j !== i) })} className="px-1.5 text-slate-400 hover:text-red-700">×</button>
                  </span>
                ))}
                <button type="button" onClick={() => setQ(q.id, { options: [...q.options, `Option ${q.options.length + 1}`] })}
                  className="h-7 rounded-md border border-dashed border-slate-300 px-2 text-[12px] text-slate-500 hover:text-indigo-700">+ Option</button>
              </div>
            ) : null}
          </div>
        ))}
      </div>
      {form.questions.length < MAX_FIT_QUESTIONS ? (
        <button type="button" onClick={addQ} className="mt-2.5 inline-flex items-center gap-1.5 rounded-md border border-[var(--border-subtle)] px-3 py-1.5 text-[13px] text-[var(--text-secondary)] hover:bg-slate-50">
          <Plus className="h-3.5 w-3.5" /> Add question
        </button>
      ) : null}
    </div>
  );
}
