"use client";

import { useMemo, useState } from "react";
import {
  EVERY_OPTIONS,
  cronFromForm,
  formFromCron,
  formFromUtcDefault,
  nextRunsInZone,
  zonedLocalToUtc,
  type RepeatMode,
  type ScheduleForm,
} from "@/lib/cron/zoned-schedule";
import { PLATFORM_TZ } from "@/lib/time/platform-tz";

export type EditableJob = {
  path: string;
  name: string;
  defaultSchedule: string;
  defaultCron: string[];
  custom: { cron: string[] | null; nextRunLocal: string | null } | null;
};

const MODES: Array<{ key: RepeatMode; label: string }> = [
  { key: "every", label: "Every N min" },
  { key: "hourly", label: "Hourly" },
  { key: "daily", label: "Daily" },
  { key: "weekly", label: "Weekly" },
];
const DAYS: Array<{ n: number; label: string }> = [
  { n: 1, label: "Mon" },
  { n: 2, label: "Tue" },
  { n: 3, label: "Wed" },
  { n: 4, label: "Thu" },
  { n: 5, label: "Fri" },
  { n: 6, label: "Sat" },
  { n: 0, label: "Sun" },
];
const PREVIEW = new Intl.DateTimeFormat("en-GB", { timeZone: PLATFORM_TZ, weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

const pill = (on: boolean): React.CSSProperties => ({
  border: `0.5px solid ${on ? "#C9CCF6" : "#e2e6ed"}`,
  background: on ? "#EEF0FF" : "#fff",
  color: on ? "#4F46E5" : "#334155",
  fontWeight: on ? 600 : 500,
  borderRadius: 8,
  padding: "5px 10px",
  fontSize: 12.5,
  cursor: "pointer",
});
const input: React.CSSProperties = { border: "0.5px solid #cbd5e1", borderRadius: 6, padding: "4px 8px", fontSize: 13, background: "#fff", color: "#0F172A" };
const label: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: "var(--muted-foreground)", minWidth: 64 };
const btn: React.CSSProperties = { borderRadius: 8, padding: "7px 12px", fontSize: 13, fontWeight: 600, cursor: "pointer" };

/** Edit schedule and next run for one job (Admin, System, Scheduled jobs). Times are Pacific time (PT). */
export function JobScheduleEditor({ job, onClose, onDone }: { job: EditableJob; onClose: () => void; onDone: (message: string) => void }) {
  const [openedAt] = useState(() => new Date());
  const [form, setForm] = useState<ScheduleForm>(() => (job.custom?.cron ? formFromCron(job.custom.cron) : null) ?? formFromUtcDefault(job.defaultCron, openedAt));
  const [scheduleTouched, setScheduleTouched] = useState(false);
  const [nextLocal, setNextLocal] = useState(job.custom?.nextRunLocal ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const edit = (patch: Partial<ScheduleForm>) => {
    setForm((f) => ({ ...f, ...patch }));
    setScheduleTouched(true);
  };

  // What gets saved: the custom schedule only when one exists or the Repeat section was changed.
  const customCron = scheduleTouched || job.custom?.cron ? cronFromForm(form) : null;
  const incomplete = (scheduleTouched || Boolean(job.custom?.cron)) && !customCron;

  const preview = useMemo(() => {
    const regular = customCron ? nextRunsInZone(customCron, openedAt, 3) : [];
    const oneOff = nextLocal ? zonedLocalToUtc(nextLocal) : null;
    const all = [...(oneOff && oneOff > openedAt ? [oneOff] : []), ...regular].sort((a, b) => a.getTime() - b.getTime()).slice(0, 3);
    return all.map((d) => PREVIEW.format(d).replace(",", ""));
  }, [customCron, nextLocal, openedAt]);

  async function send(body: Record<string, unknown>, done: string) {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/admin/scheduled-jobs/schedule", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ job: job.path, ...body }),
    }).catch(() => null);
    const out = res ? ((await res.json().catch(() => null)) as { error?: string } | null) : null;
    setBusy(false);
    if (!res?.ok) {
      setError(out?.error ?? "Couldn't save. Try again.");
      return;
    }
    onDone(done);
  }

  const save = () => {
    if (incomplete) {
      setError("Finish the schedule first: pick at least one time, and a day for weekly.");
      return;
    }
    if (!customCron && !nextLocal) {
      onClose();
      return;
    }
    void send({ action: "save", cron: customCron, nextRunLocal: nextLocal || null }, `${job.name}: schedule saved. It takes effect within 5 minutes.`);
  };

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(12,35,64,.35)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 60, padding: 16 }}>
      <div role="dialog" aria-label={`Edit schedule for ${job.name}`} onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 520, background: "#fff", border: "0.5px solid #e2e6ed", borderRadius: 16, padding: 20, boxShadow: "0 12px 40px rgba(12,35,64,.22)", display: "grid", gap: 14 }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: "#0F172A" }}>{job.name}</h3>
          <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--muted-foreground)" }}>
            Default: {job.defaultSchedule}
            {job.custom?.cron ? " · now on a custom schedule" : ""}
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span style={label}>Repeat</span>
          {MODES.map((m) => (
            <button key={m.key} type="button" aria-pressed={form.mode === m.key} onClick={() => edit({ mode: m.key })} style={pill(form.mode === m.key)}>
              {m.label}
            </button>
          ))}
        </div>

        {form.mode === "every" && (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={label}>Every</span>
            <select aria-label="Minutes between runs" value={form.every} onChange={(e) => edit({ every: Number(e.target.value) })} style={input}>
              {EVERY_OPTIONS.map((n) => (
                <option key={n} value={n}>{n} minutes</option>
              ))}
            </select>
          </div>
        )}

        {form.mode === "hourly" && (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={label}>At</span>
            <span style={{ fontSize: 13 }}>minute</span>
            <input aria-label="Minute past the hour" type="number" min={0} max={59} value={form.minute} onChange={(e) => edit({ minute: Math.max(0, Math.min(59, Number(e.target.value) || 0)) })} style={{ ...input, width: 64 }} />
            <span style={{ fontSize: 12, color: "var(--muted-foreground)" }}>past each hour</span>
          </div>
        )}

        {(form.mode === "daily" || form.mode === "weekly") && (
          <>
            {form.mode === "weekly" && (
              <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                <span style={label}>On</span>
                {DAYS.map((d) => {
                  const on = form.days.includes(d.n);
                  return (
                    <button key={d.n} type="button" aria-pressed={on} onClick={() => edit({ days: on ? form.days.filter((x) => x !== d.n) : [...form.days, d.n] })} style={pill(on)}>
                      {d.label}
                    </button>
                  );
                })}
              </div>
            )}
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span style={label}>At</span>
              {form.times.map((t, i) => (
                <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 2 }}>
                  <input aria-label={`Time ${i + 1}`} type="time" value={t} onChange={(e) => edit({ times: form.times.map((x, j) => (j === i ? e.target.value : x)) })} style={input} />
                  {form.times.length > 1 && (
                    <button type="button" aria-label={`Remove time ${i + 1}`} onClick={() => edit({ times: form.times.filter((_, j) => j !== i) })} style={{ border: "none", background: "none", color: "#94a3b8", cursor: "pointer", fontSize: 14 }}>
                      ×
                    </button>
                  )}
                </span>
              ))}
              {form.times.length < 6 && (
                <button type="button" onClick={() => edit({ times: [...form.times, "12:00"] })} style={{ border: "none", background: "none", color: "#4F46E5", fontWeight: 600, fontSize: 12.5, cursor: "pointer" }}>
                  + add a time
                </button>
              )}
              <span style={{ fontSize: 12, color: "var(--muted-foreground)" }}>Pacific time (PT)</span>
            </div>
          </>
        )}

        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", borderTop: "0.5px solid #eef1f5", paddingTop: 12 }}>
          <span style={label}>Next run</span>
          <input aria-label="One-off next run, Pacific time" type="datetime-local" value={nextLocal} onChange={(e) => setNextLocal(e.target.value)} style={input} />
          {nextLocal && (
            <button type="button" onClick={() => setNextLocal("")} style={{ border: "none", background: "none", color: "#64748B", fontSize: 12, cursor: "pointer" }}>
              Clear
            </button>
          )}
          <span style={{ fontSize: 12, color: "var(--muted-foreground)" }}>one time only, then back to the schedule</span>
        </div>

        <p style={{ margin: 0, fontSize: 12.5, color: "#27500A", background: "#EAF3DE", borderRadius: 6, padding: "6px 9px" }}>
          {preview.length ? `Next runs: ${preview.join(", then ")}` : scheduleTouched || job.custom?.cron ? "Pick a time to see the next runs." : `Keeps its default schedule: ${job.defaultSchedule}.`}
        </p>

        {error && <p role="alert" style={{ margin: 0, fontSize: 12.5, color: "#791F1F" }}>{error}</p>}

        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <button type="button" disabled={busy} onClick={() => void send({ action: "run-now" }, `${job.name} started. It shows in Last runs within a minute.`)} style={{ ...btn, border: "0.5px solid #C9CCF6", background: "#fff", color: "#4F46E5" }}>
            Run now
          </button>
          {job.custom && (
            <button type="button" disabled={busy} onClick={() => void send({ action: "reset" }, `${job.name} is back on its default schedule.`)} style={{ ...btn, border: "0.5px solid #e2e6ed", background: "#fff", color: "#334155" }}>
              Reset to default
            </button>
          )}
          <span style={{ marginLeft: "auto", display: "inline-flex", gap: 8 }}>
            <button type="button" onClick={onClose} style={{ ...btn, border: "0.5px solid #e2e6ed", background: "#fff", color: "#334155" }}>
              Cancel
            </button>
            <button type="button" disabled={busy} onClick={save} style={{ ...btn, border: "none", background: "#4F46E5", color: "#fff", opacity: busy ? 0.6 : 1 }}>
              {busy ? "Saving…" : "Save"}
            </button>
          </span>
        </div>
        <p style={{ margin: 0, fontSize: 11.5, color: "var(--muted-foreground)" }}>Takes effect within 5 minutes, no deploy needed. A paused job stays paused.</p>
      </div>
    </div>
  );
}
