"use client";

import { useState } from "react";
import type { SupportCareSettings, SupportRecipient } from "@/lib/support/settings";
import type { StaffOption } from "./SupportQueueClient";

const INTERVALS = [1, 4, 8, 24] as const;
const TARGETS = [
  { hours: 4, label: "4 business hours" },
  { hours: 9, label: "1 business day" },
  { hours: 18, label: "2 business days" },
];

const initials = (name: string) =>
  name.split(/[\s.@]+/).filter(Boolean).map((w) => w[0]).join("").slice(0, 2).toUpperCase();

function Switch({ on, onChange, label, disabled }: Readonly<{ on: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }>) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!on)}
      className={`relative h-5 w-9 flex-shrink-0 rounded-full transition-colors ${on ? "bg-indigo-600" : "bg-slate-300"} disabled:opacity-60`}
    >
      <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${on ? "left-[18px]" : "left-0.5"}`} />
    </button>
  );
}

/**
 * Support queue, Notifications: who on staff hears about requests, how
 * reminders repeat until a request is resolved, the promised reply time, and
 * which AI jobs run. Admins change it; analysts can look.
 */
export function SupportSettingsPanel({
  initial,
  staff,
  canEdit,
  onClose,
}: Readonly<{ initial: SupportCareSettings; staff: StaffOption[]; canEdit: boolean; onClose: () => void }>) {
  const [s, setS] = useState<SupportCareSettings>(initial);
  const [pick, setPick] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  const nameOf = (id: string) => staff.find((p) => p.id === id)?.name ?? "Staff";
  const available = staff.filter((p) => !s.recipients.some((r) => r.userId === p.id));

  function setRecipient(userId: string, patch: Partial<SupportRecipient>) {
    setS((x) => ({ ...x, recipients: x.recipients.map((r) => (r.userId === userId ? { ...r, ...patch } : r)) }));
  }

  async function save() {
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/support/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings: s }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg({ tone: "error", text: j.error ?? "Couldn't save. Try again." });
        return;
      }
      setS(j.settings);
      setMsg({ tone: "ok", text: "Saved" });
    } catch {
      setMsg({ tone: "error", text: "Network error. Try again." });
    } finally {
      setSaving(false);
    }
  }

  const ro = !canEdit;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4 sm:items-center">
      <div className="w-full max-w-2xl rounded-2xl bg-white shadow-xl">
        <div className="flex items-start justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Support notifications</h2>
            <p className="mt-0.5 text-xs text-slate-500">Applies to every founder support request.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100" aria-label="Close">
            <i className="ti ti-x" aria-hidden="true" />
          </button>
        </div>

        <div className="grid gap-6 px-5 py-4 md:grid-cols-2">
          <section>
            <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">Notify on</h3>
            <label className="flex items-center gap-2 py-1 text-sm text-slate-700">
              <input type="checkbox" disabled={ro} checked={s.notifyOnNew} onChange={(e) => setS({ ...s, notifyOnNew: e.target.checked })} /> New request submitted
            </label>
            <label className="flex items-center gap-2 py-1 text-sm text-slate-700">
              <input type="checkbox" disabled={ro} checked={s.notifyOnFounderReply} onChange={(e) => setS({ ...s, notifyOnFounderReply: e.target.checked })} /> Founder replies to a request
            </label>

            <h3 className="mb-2 mt-5 text-xs font-medium uppercase tracking-wide text-slate-500">Keep reminding until resolved</h3>
            <label className="flex items-center gap-2 py-1 text-sm text-slate-700">
              <input
                type="checkbox"
                disabled={ro}
                checked={s.reminders.enabled}
                onChange={(e) => setS({ ...s, reminders: { ...s.reminders, enabled: e.target.checked } })}
              />{" "}
              Repeat the alert while the request is open
            </label>
            <div className={`ml-6 mt-1 space-y-2 ${s.reminders.enabled ? "" : "opacity-50"}`}>
              <label className="flex items-center gap-2 text-sm text-slate-700">
                Every
                <select
                  disabled={ro || !s.reminders.enabled}
                  value={s.reminders.everyHours}
                  onChange={(e) => setS({ ...s, reminders: { ...s.reminders, everyHours: Number(e.target.value) as SupportCareSettings["reminders"]["everyHours"] } })}
                  className="rounded-lg border border-slate-200 px-2 py-1 text-sm"
                >
                  {INTERVALS.map((h) => (
                    <option key={h} value={h}>{h === 1 ? "1 hour" : `${h} hours`}</option>
                  ))}
                </select>
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  disabled={ro || !s.reminders.enabled}
                  checked={s.reminders.businessHoursOnly}
                  onChange={(e) => setS({ ...s, reminders: { ...s.reminders, businessHoursOnly: e.target.checked } })}
                />{" "}
                Business hours only (9:00 to 18:00 Pacific, Mon to Fri)
              </label>
              <p className="text-xs text-slate-400">Stops the moment someone clicks Resolve.</p>
            </div>

            <h3 className="mb-2 mt-5 text-xs font-medium uppercase tracking-wide text-slate-500">Promised first reply</h3>
            <select
              disabled={ro}
              value={TARGETS.some((t) => t.hours === s.replyTargetHours) ? s.replyTargetHours : 9}
              onChange={(e) => setS({ ...s, replyTargetHours: Number(e.target.value) })}
              className="rounded-lg border border-slate-200 px-2 py-1 text-sm"
            >
              {TARGETS.map((t) => (
                <option key={t.hours} value={t.hours}>{t.label}</option>
              ))}
            </select>
            <p className="mt-1 text-xs text-slate-400">
              Shown to the founder. Staff are alerted 2 hours before; if it passes, the founder gets an honest update with a new time.
            </p>
          </section>

          <section>
            <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">Who gets notified</h3>
            <div className="grid grid-cols-[minmax(0,1fr)_52px_52px_24px] border-b border-slate-100 pb-1.5 text-[11px] text-slate-500">
              <span>Staff</span>
              <span className="text-center">In app</span>
              <span className="text-center">Email</span>
              <span />
            </div>
            {s.recipients.length === 0 ? (
              <p className="py-3 text-xs text-slate-400">Nobody listed. Only the assigned staff member is notified.</p>
            ) : (
              s.recipients.map((r) => (
                <div key={r.userId} className="grid grid-cols-[minmax(0,1fr)_52px_52px_24px] items-center border-b border-slate-100 py-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-indigo-50 text-[10px] font-semibold text-indigo-700">
                      {initials(nameOf(r.userId))}
                    </span>
                    <span className="truncate text-sm text-slate-800">{nameOf(r.userId)}</span>
                  </div>
                  <span className="text-center">
                    <input type="checkbox" aria-label="In app" disabled={ro} checked={r.inApp} onChange={(e) => setRecipient(r.userId, { inApp: e.target.checked })} />
                  </span>
                  <span className="text-center">
                    <input type="checkbox" aria-label="Email" disabled={ro} checked={r.email} onChange={(e) => setRecipient(r.userId, { email: e.target.checked })} />
                  </span>
                  {ro ? (
                    <span />
                  ) : (
                    <button
                      type="button"
                      aria-label={`Remove ${nameOf(r.userId)}`}
                      onClick={() => setS({ ...s, recipients: s.recipients.filter((x) => x.userId !== r.userId) })}
                      className="text-slate-400 hover:text-slate-600"
                    >
                      <i className="ti ti-x" aria-hidden="true" />
                    </button>
                  )}
                </div>
              ))
            )}
            {ro ? null : (
              <div className="mt-2 flex gap-2">
                <select value={pick} onChange={(e) => setPick(e.target.value)} className="min-w-0 flex-1 rounded-lg border border-slate-200 px-2 py-1.5 text-sm">
                  <option value="">Add staff…</option>
                  {available.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
                <button
                  type="button"
                  disabled={!pick}
                  onClick={() => {
                    setS({ ...s, recipients: [...s.recipients, { userId: pick, inApp: true, email: true }] });
                    setPick("");
                  }}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  <i className="ti ti-plus" aria-hidden="true" /> Add
                </button>
              </div>
            )}
            <p className="mt-3 rounded-lg bg-indigo-50 px-3 py-2 text-xs text-indigo-800">
              <i className="ti ti-info-circle mr-1" aria-hidden="true" />
              The assigned staff member is always notified, even if not listed. No one gets the same alert twice.
            </p>

            <h3 className="mb-1 mt-5 text-xs font-medium uppercase tracking-wide text-slate-500">AI</h3>
            {[
              { key: "triage" as const, label: "Triage new requests", sub: "Topic, priority, and whether a person is needed. Internal only." },
              { key: "drafts" as const, label: "Draft replies and resolve summaries", sub: "Staff review and edit before anything is sent." },
              { key: "answerFounders" as const, label: "Answer founders directly", sub: "How-to questions only. Off sends every question to a person." },
            ].map((row) => (
              <div key={row.key} className="flex items-center justify-between gap-3 border-b border-slate-100 py-2 last:border-b-0">
                <div>
                  <p className="text-sm text-slate-800">{row.label}</p>
                  <p className="text-[11.5px] text-slate-400">{row.sub}</p>
                </div>
                <Switch label={row.label} disabled={ro} on={s.ai[row.key]} onChange={(v) => setS({ ...s, ai: { ...s.ai, [row.key]: v } })} />
              </div>
            ))}
          </section>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-5 py-3">
          {msg ? <span className={`mr-auto text-xs font-medium ${msg.tone === "ok" ? "text-emerald-600" : "text-red-600"}`}>{msg.text}</span> : null}
          {ro ? <span className="mr-auto text-xs text-slate-400">Only admins can change these settings.</span> : null}
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
            {ro ? "Close" : "Cancel"}
          </button>
          {ro ? null : (
            <button type="button" disabled={saving} onClick={save} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60">
              {saving ? "Saving…" : "Save"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
