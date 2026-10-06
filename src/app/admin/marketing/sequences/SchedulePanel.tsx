"use client";

// Schedule an existing sequence's sends: date range, repeat, send time (PT),
// max per run, review reminder, and what happens if a batch isn't reviewed.

import { useEffect, useMemo, useState } from "react";
import {
  countRuns, formatPt, nextRuns, todayInPt,
  type RepeatRule, type SequenceSchedule,
} from "@/lib/marketing/sequence-schedule";

type Form = {
  start_date: string; end_date: string; repeat: RepeatRule; weekdays: number[];
  send_time: string; max_per_run: string; reminder_minutes: number; unreviewed_action: "send" | "hold";
};

/** Fired after a schedule is saved or turned off, so the list and the batches refresh. */
export const SCHEDULES_CHANGED = "sequence-schedules-changed";

const REPEATS: { key: RepeatRule; label: string }[] = [
  { key: "once", label: "Once" }, { key: "daily", label: "Daily" }, { key: "weekdays", label: "Weekdays" },
  { key: "weekly", label: "Weekly" }, { key: "monthly", label: "Monthly" },
];
const DAYS = [{ d: 1, l: "M" }, { d: 2, l: "T" }, { d: 3, l: "W" }, { d: 4, l: "T" }, { d: 5, l: "F" }, { d: 6, l: "S" }, { d: 0, l: "S" }];
const REMINDERS = [{ v: 60, l: "1 hour before each run" }, { v: 180, l: "3 hours before each run" }, { v: 1440, l: "The day before" }, { v: 0, l: "Off" }];

const label: React.CSSProperties = { fontSize: 11.5, color: "var(--muted-foreground)", marginBottom: 4, display: "block" };
const input: React.CSSProperties = { width: "100%", fontSize: 12.5, padding: "7px 9px", borderRadius: 7, border: "0.5px solid var(--border)", background: "var(--background)", color: "var(--foreground)", boxSizing: "border-box" };

function fromSchedule(s: SequenceSchedule | null): Form {
  return {
    start_date: s?.start_date ?? todayInPt(),
    end_date: s?.end_date ?? "",
    repeat: s?.repeat ?? "weekdays",
    weekdays: s?.weekdays?.length ? s.weekdays : [1, 2, 3, 4, 5],
    send_time: s?.send_time ?? "09:00",
    max_per_run: String(s?.max_per_run ?? 100),
    reminder_minutes: s?.reminder_minutes ?? 60,
    unreviewed_action: s?.unreviewed_action ?? "send",
  };
}

export function SchedulePanel({ sequenceId, sequenceName, onClose, onSaved }: {
  sequenceId: string; sequenceName: string; onClose: () => void; onSaved: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [existing, setExisting] = useState<SequenceSchedule | null>(null);
  const [canEdit, setCanEdit] = useState(true);
  const [f, setF] = useState<Form>(fromSchedule(null));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    void (async () => {
      try {
        const res = await fetch(`/api/marketing/sequences/${sequenceId}/schedule`);
        const data = res.ok ? await res.json() : { schedule: null, canEdit: false };
        if (!live) return;
        setExisting(data.schedule); setCanEdit(!!data.canEdit); setF(fromSchedule(data.schedule));
      } finally { if (live) setLoading(false); }
    })();
    return () => { live = false; };
  }, [sequenceId]);

  const preview = useMemo(() => {
    const s = { start_date: f.start_date, end_date: f.end_date || null, repeat: f.repeat, weekdays: f.weekdays, send_time: f.send_time };
    return { next: nextRuns(s, new Date(), 3), total: countRuns(s) };
  }, [f]);

  const set = <K extends keyof Form>(k: K, v: Form[K]) => { setF((p) => ({ ...p, [k]: v })); setError(null); };

  async function save() {
    const max = Number(f.max_per_run);
    if (!f.start_date) return setError("Pick a start date.");
    if (f.end_date && f.end_date < f.start_date) return setError("The end date is before the start date.");
    if (f.repeat === "weekly" && f.weekdays.length === 0) return setError("Pick at least one day.");
    if (!/^\d{2}:\d{2}$/.test(f.send_time)) return setError("Pick a send time.");
    if (!Number.isInteger(max) || max < 1 || max > 5000) return setError("Max sends per run must be 1 to 5,000.");
    setBusy(true); setError(null);
    try {
      const res = await fetch(`/api/marketing/sequences/${sequenceId}/schedule`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enabled: true, start_date: f.start_date, end_date: f.end_date || null, repeat: f.repeat,
          weekdays: f.repeat === "weekly" ? f.weekdays : [], send_time: f.send_time, max_per_run: max,
          reminder_minutes: f.reminder_minutes, unreviewed_action: f.unreviewed_action,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Couldn't save the schedule.");
      window.dispatchEvent(new Event(SCHEDULES_CHANGED)); onSaved(); onClose();
    } catch (e) { setError(e instanceof Error ? e.message : "Couldn't save the schedule."); }
    finally { setBusy(false); }
  }

  async function removeSchedule() {
    setBusy(true); setError(null);
    try {
      const res = await fetch(`/api/marketing/sequences/${sequenceId}/schedule`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Couldn't turn off the schedule.");
      window.dispatchEvent(new Event(SCHEDULES_CHANGED)); onSaved(); onClose();
    } catch (e) { setError(e instanceof Error ? e.message : "Couldn't turn off the schedule."); }
    finally { setBusy(false); }
  }

  const chip = (on: boolean): React.CSSProperties => ({
    fontSize: 12, padding: "5px 12px", borderRadius: 7, cursor: canEdit ? "pointer" : "default",
    border: on ? "1px solid #378ADD" : "0.5px solid var(--border)", background: on ? "#E6F1FB" : "var(--background)", color: on ? "#0C447C" : "var(--foreground)",
  });
  const dayChip = (on: boolean, clickable: boolean): React.CSSProperties => ({
    width: 30, textAlign: "center", padding: "4px 0", borderRadius: 7, fontSize: 12, cursor: clickable ? "pointer" : "default",
    border: on ? "1px solid #378ADD" : "0.5px solid var(--border)", background: on ? "#E6F1FB" : "var(--background)", color: on ? "#0C447C" : "var(--muted-foreground)",
  });
  const dayOn = (d: number) => f.repeat === "weekly" ? f.weekdays.includes(d) : f.repeat === "weekdays" ? d >= 1 && d <= 5 : f.repeat === "daily";

  return (
    <div role="dialog" aria-modal="true" aria-label="Schedule sends" onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.35)", zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 560, maxHeight: "90vh", overflowY: "auto", background: "var(--background)", borderRadius: 12, border: "0.5px solid var(--border)", padding: "16px 18px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div style={{ fontSize: 15, fontWeight: 500 }}>Schedule sends</div>
          <button type="button" onClick={onClose} aria-label="Close" style={{ border: "none", background: "none", cursor: "pointer", color: "var(--muted-foreground)", fontSize: 16 }}><i className="ti ti-x" aria-hidden="true" /></button>
        </div>
        {loading ? <div style={{ fontSize: 12.5, color: "var(--muted-foreground)" }}>Loading…</div> : (
          <fieldset disabled={!canEdit || busy} style={{ border: "none", padding: 0, margin: 0 }}>
            <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: 12 }}>
              <div style={{ gridColumn: "1 / -1" }}>
                <span style={label}>Sequence</span>
                <div style={{ ...input, background: "var(--muted)" }}>{sequenceName}</div>
              </div>
              <label><span style={label}>Start date</span><input type="date" value={f.start_date} onChange={(e) => set("start_date", e.target.value)} style={input} /></label>
              <label><span style={label}>End date</span><input type="date" value={f.end_date} min={f.start_date} onChange={(e) => set("end_date", e.target.value)} style={input} disabled={f.repeat === "once"} placeholder="No end date" /></label>
            </div>

            <span style={{ ...label, marginTop: 14 }}>Repeat</span>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {REPEATS.map((r) => <button type="button" key={r.key} onClick={() => set("repeat", r.key)} style={chip(f.repeat === r.key)}>{r.label}</button>)}
            </div>
            {f.repeat !== "once" && f.repeat !== "monthly" && (
              <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                {DAYS.map((x) => (
                  <button type="button" key={x.d} aria-pressed={dayOn(x.d)} aria-label={["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][x.d]}
                    onClick={() => f.repeat === "weekly" && set("weekdays", f.weekdays.includes(x.d) ? f.weekdays.filter((d) => d !== x.d) : [...f.weekdays, x.d])}
                    style={dayChip(dayOn(x.d), f.repeat === "weekly")}>{x.l}</button>
                ))}
              </div>
            )}

            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 12, marginTop: 14 }}>
              <label><span style={label}>Send time</span><input type="time" value={f.send_time} onChange={(e) => set("send_time", e.target.value)} style={input} /></label>
              <div><span style={label}>Time zone</span><div style={{ ...input, background: "var(--muted)" }}>Pacific Time (PT)</div></div>
              <label><span style={label}>Max sends per run</span><input type="number" min={1} max={5000} value={f.max_per_run} onChange={(e) => set("max_per_run", e.target.value)} style={input} /></label>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: 12, marginTop: 14 }}>
              <label><span style={label}>Review reminder</span>
                <select value={f.reminder_minutes} onChange={(e) => set("reminder_minutes", Number(e.target.value))} style={input}>
                  {REMINDERS.map((r) => <option key={r.v} value={r.v}>{r.l}</option>)}
                </select>
              </label>
              <label><span style={label}>If not reviewed by send time</span>
                <select value={f.unreviewed_action} onChange={(e) => set("unreviewed_action", e.target.value as "send" | "hold")} style={input}>
                  <option value="send">Send anyway</option>
                  <option value="hold">Hold until reviewed</option>
                </select>
              </label>
            </div>

            <div style={{ background: "var(--muted)", borderRadius: 8, padding: "10px 12px", marginTop: 14, fontSize: 12.5 }}>
              <div style={{ fontSize: 11.5, color: "var(--muted-foreground)", marginBottom: 6 }}>
                Next runs · {preview.total >= 500 ? "500+" : preview.total} {preview.total === 1 ? "run" : "runs"} in range · all times PT
              </div>
              {preview.next.length === 0 ? <div style={{ color: "var(--muted-foreground)" }}>No runs left in this range.</div> :
                preview.next.map((d, i) => (
                  <div key={d.toISOString()} style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", gap: 12 }}>
                    <span>{formatPt(d)}</span>
                    <span style={{ color: "var(--muted-foreground)" }}>{i === 0 ? "Pending batches" : "Due steps"} · up to {Number(f.max_per_run) || 0}</span>
                  </div>
                ))}
            </div>
          </fieldset>
        )}
        {!canEdit && !loading ? <p style={{ fontSize: 12, color: "#854F0B", marginTop: 10 }}>Only an approver or a super admin can change this schedule.</p> : null}
        {error ? <p style={{ fontSize: 12, color: "#A32D2D", marginTop: 10 }}>{error}</p> : null}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginTop: 14 }}>
          <span>{existing && canEdit ? <button type="button" onClick={() => void removeSchedule()} disabled={busy} style={{ fontSize: 12, border: "none", background: "none", color: "#A32D2D", cursor: "pointer", padding: 0 }}>Turn off schedule</button> : null}</span>
          <span style={{ display: "flex", gap: 8 }}>
            <button type="button" onClick={onClose} style={{ fontSize: 12.5, padding: "7px 14px", borderRadius: 8, border: "0.5px solid var(--border)", background: "var(--background)", color: "var(--foreground)", cursor: "pointer" }}>Cancel</button>
            {canEdit ? <button type="button" onClick={() => void save()} disabled={busy || loading} style={{ fontSize: 12.5, padding: "7px 14px", borderRadius: 8, border: "none", background: "#0F6E56", color: "#fff", cursor: "pointer", opacity: busy ? 0.6 : 1 }}>{busy ? "Saving…" : "Save schedule"}</button> : null}
          </span>
        </div>
      </div>
    </div>
  );
}
