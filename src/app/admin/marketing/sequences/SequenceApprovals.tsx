"use client";

// Scheduled sends: pending sequence batches and when each one goes out. A batch
// sends at its sequence's scheduled time (PT); before that you can review it,
// move it to another time, hold it, or send it now. Changing when a batch sends
// takes manage_actions (or super_admin); anyone on staff can review.

import { useCallback, useEffect, useState } from "react";
import { formatIn, formatPt, SCHEDULE_TZ } from "@/lib/marketing/sequence-schedule";
import { utcToZonedLocal, zonedLocalToUtc } from "@/lib/cron/zoned-schedule";
import { SchedulePanel, SCHEDULES_CHANGED } from "./SchedulePanel";

interface Batch {
  id: string; sequence_id: string; sequence_name: string; step_order: number; step_name: string | null;
  will_send_count: number; suppressed_count: number; skipped_count: number; created_at: string;
  approver_name: string | null;
  reviewed_at: string | null; on_hold: boolean; send_after: string | null;
  send_at: string | null; send_state: "scheduled" | "custom" | "hold" | "waiting_review" | "sending" | "manual";
  schedule_label: string | null; reminder_at: string | null;
}
interface Preview {
  subject: string | null; html_body: string | null; from_name: string | null; from_email: string | null;
  recipients: { email: string; name: string; company: string | null }[]; total: number;
}

const btn: React.CSSProperties = { fontSize: 11.5, fontWeight: 500, color: "var(--foreground)", background: "var(--background)", border: "0.5px solid var(--border)", borderRadius: 7, padding: "6px 10px", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 5, whiteSpace: "nowrap" };
const primary: React.CSSProperties = { ...btn, color: "#fff", background: "#0F6E56", border: "none" };
const tag = (bg: string, color: string): React.CSSProperties => ({ fontSize: 11, background: bg, color, padding: "1px 8px", borderRadius: 7, whiteSpace: "nowrap" });

export function SequenceApprovals({ canApprove }: { canApprove: boolean }) {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [reviewing, setReviewing] = useState<string | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [rescheduling, setRescheduling] = useState<string | null>(null);
  const [when, setWhen] = useState("");
  const [scheduleFor, setScheduleFor] = useState<{ id: string; name: string } | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/marketing/sequence-batches");
      setBatches(res.ok ? await res.json() : []);
    } catch { setBatches([]); }
    setLoading(false);
    setNow(Date.now());
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch pending batches on mount
  useEffect(() => { void load(); }, [load]);
  useEffect(() => { const f = () => void load(); window.addEventListener(SCHEDULES_CHANGED, f); return () => window.removeEventListener(SCHEDULES_CHANGED, f); }, [load]);
  // Keep the countdowns current.
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 60_000); return () => clearInterval(t); }, []);

  async function release(id: string) {
    setBusy(id); setError(null); setMsg(null);
    let sent = 0, failed = 0;
    try {
      // The server sends in bounded chunks so it never times out; keep calling until
      // there's nothing left to send, showing running progress.
      for (let i = 0; i < 400; i++) {
        const res = await fetch(`/api/marketing/sequence-batches/${id}/release`, { method: "POST" });
        // Parse defensively: a timeout or runtime error can return a non-JSON body.
        const text = await res.text();
        let data: { error?: string; sent?: number; failed?: number; remaining?: number } = {};
        try { data = text ? JSON.parse(text) : {}; }
        catch {
          throw new Error(
            res.status === 504 || res.status === 502
              ? "The send timed out. Retry to continue where it left off."
              : `Send failed (${res.status}). The server returned an unexpected response.`,
          );
        }
        if (!res.ok) throw new Error(data.error ?? `Send failed (${res.status}).`);
        sent += data.sent ?? 0; failed += data.failed ?? 0;
        const remaining = data.remaining ?? 0;
        if (remaining > 0) setMsg(`Sending… ${sent.toLocaleString()} sent · ${remaining.toLocaleString()} to go`);
        else break;
      }
      setMsg(`Sent: ${sent.toLocaleString()}${failed ? `, ${failed} failed` : ""}.`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Send failed.");
    } finally { setBusy(null); }
  }

  async function act(id: string, body: Record<string, unknown>) {
    setBusy(id); setError(null);
    try {
      const res = await fetch(`/api/marketing/sequence-batches/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "That didn't save.");
      await load();
      return true;
    } catch (err) { setError(err instanceof Error ? err.message : "That didn't save."); return false; }
    finally { setBusy(null); }
  }

  async function openReview(id: string) {
    if (reviewing === id) { setReviewing(null); return; }
    setReviewing(id); setPreview(null); setRescheduling(null);
    const res = await fetch(`/api/marketing/sequence-batches/${id}`);
    setPreview(res.ok ? await res.json() : null);
  }

  function openReschedule(b: Batch) {
    if (rescheduling === b.id) { setRescheduling(null); return; }
    setRescheduling(b.id); setReviewing(null);
    setWhen(utcToZonedLocal(new Date(b.send_at ?? Date.now() + 3_600_000), SCHEDULE_TZ));
  }

  async function saveReschedule(id: string) {
    const at = zonedLocalToUtc(when, SCHEDULE_TZ);
    if (!at) { setError("Pick a date and time."); return; }
    if (at.getTime() <= Date.now()) { setError("Pick a time in the future, or use Send now."); return; }
    if (await act(id, { action: "reschedule", send_after: at.toISOString() })) setRescheduling(null);
  }

  if (loading || batches.length === 0) return null;

  function sendLine(b: Batch) {
    const at = b.send_at ? new Date(b.send_at) : null;
    switch (b.send_state) {
      case "hold": return <span style={{ color: "#854F0B" }}>On hold, won&apos;t send until resumed</span>;
      case "manual": return <span style={{ color: "var(--muted-foreground)" }}>Not scheduled</span>;
      case "sending": return <span style={{ color: "#0F6E56" }}>Sending now</span>;
      case "waiting_review": return <span style={{ color: "#854F0B" }}>Waiting for review{at ? `, next run ${formatPt(at)}` : ""}</span>;
      default: return at ? <><span style={{ color: "#185FA5" }}>Sends {formatPt(at)}</span> · {formatIn(at, new Date(now))}{b.send_state === "custom" ? " · moved" : ""}</> : <span style={{ color: "var(--muted-foreground)" }}>No run left in the schedule</span>;
    }
  }

  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: "#185FA5", marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
        <i className="ti ti-clock" aria-hidden="true" /> Scheduled sends · {batches.length} {batches.length === 1 ? "batch" : "batches"}
      </div>
      {msg ? <p style={{ background: "#ECFDF5", border: "0.5px solid #A7F3D0", color: "#065F46", fontSize: 12, borderRadius: 8, padding: "8px 12px", marginBottom: 10 }}>{msg}</p> : null}
      {error ? <p style={{ background: "#FEF2F2", border: "0.5px solid #FECACA", color: "#991B1B", fontSize: 12, borderRadius: 8, padding: "8px 12px", marginBottom: 10 }}>{error}</p> : null}
      <div style={{ border: "0.5px solid var(--border)", borderRadius: 12, background: "var(--background)", overflow: "hidden" }}>
        {batches.map((b, i) => (
          <div key={b.id} style={{ borderTop: i ? "0.5px solid var(--border)" : "none" }}>
            <div style={{ padding: "12px 14px", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: 240 }}>
                <div style={{ fontSize: 13, fontWeight: 500 }}>{b.sequence_name} · Step {b.step_order}{b.step_name ? ` · ${b.step_name}` : ""}</div>
                <div style={{ fontSize: 11.5, color: "var(--muted-foreground)", marginTop: 2 }}>
                  {b.will_send_count.toLocaleString()} will send
                  {b.suppressed_count ? ` · ${b.suppressed_count} suppressed` : ""}
                  {b.skipped_count ? ` · ${b.skipped_count} skipped` : ""} · {sendLine(b)}
                </div>
                <div style={{ fontSize: 11.5, color: "var(--muted-foreground)", marginTop: 4, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  {b.reminder_at && !b.reviewed_at ? <span><i className="ti ti-bell" aria-hidden="true" /> Reminder to you at {formatPt(new Date(b.reminder_at)).split(", ")[1]}</span> : null}
                  {b.reviewed_at ? <span style={tag("#EAF3DE", "#27500A")}>Reviewed</span> : <span style={tag("#FAEEDA", "#633806")}>Not reviewed</span>}
                  {b.approver_name ? <span style={tag("#EFF6FF", "#1A6CE4")}>Assigned: {b.approver_name}</span> : null}
                  {b.send_state === "manual" && canApprove ? (
                    <button type="button" onClick={() => setScheduleFor({ id: b.sequence_id, name: b.sequence_name })} style={{ ...btn, padding: "2px 8px", fontSize: 11 }}><i className="ti ti-calendar" aria-hidden="true" /> Set schedule</button>
                  ) : null}
                </div>
              </div>
              <button type="button" onClick={() => void openReview(b.id)} style={btn}><i className="ti ti-eye" aria-hidden="true" /> Review</button>
              {canApprove ? (
                <>
                  <button type="button" onClick={() => openReschedule(b)} disabled={busy === b.id} style={btn}><i className="ti ti-calendar" aria-hidden="true" /> Reschedule</button>
                  {b.on_hold
                    ? <button type="button" onClick={() => void act(b.id, { action: "resume" })} disabled={busy === b.id} style={btn}><i className="ti ti-player-play" aria-hidden="true" /> Resume</button>
                    : <button type="button" onClick={() => void act(b.id, { action: "hold" })} disabled={busy === b.id} style={btn}><i className="ti ti-player-pause" aria-hidden="true" /> Hold</button>}
                  <button type="button" onClick={() => void release(b.id)} disabled={busy === b.id} style={{ ...primary, opacity: busy === b.id ? 0.5 : 1 }}>{busy === b.id ? "Working…" : "Send now"}</button>
                </>
              ) : (
                <span style={{ fontSize: 11, color: "var(--muted-foreground)", display: "flex", alignItems: "center", gap: 6 }}>
                  <i className="ti ti-lock" aria-hidden="true" /> Only an approver can change when this sends
                </span>
              )}
            </div>

            {rescheduling === b.id ? (
              <div style={{ padding: "0 14px 12px", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", fontSize: 12 }}>
                <span style={{ color: "var(--muted-foreground)" }}>Send this batch at</span>
                <input type="datetime-local" value={when} onChange={(e) => { setWhen(e.target.value); setError(null); }} style={{ fontSize: 12, padding: "5px 8px", borderRadius: 7, border: "0.5px solid var(--border)", background: "var(--background)", color: "var(--foreground)" }} />
                <span style={{ color: "var(--muted-foreground)" }}>PT</span>
                <button type="button" onClick={() => void saveReschedule(b.id)} style={primary}>Save time</button>
                {b.send_after ? <button type="button" onClick={() => void act(b.id, { action: "reschedule", send_after: null }).then((ok) => ok && setRescheduling(null))} style={btn}>Use sequence schedule</button> : null}
                <button type="button" onClick={() => setRescheduling(null)} style={btn}>Cancel</button>
              </div>
            ) : null}

            {reviewing === b.id ? (
              <div style={{ margin: "0 14px 14px", border: "0.5px solid var(--border)", borderRadius: 10, padding: "12px 14px", background: "var(--muted)" }}>
                {!preview ? <div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>Loading preview…</div> : (
                  <>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", fontSize: 12.5 }}>
                      <div><span style={{ color: "var(--muted-foreground)" }}>Subject </span><b style={{ fontWeight: 500 }}>{preview.subject ?? "(no subject)"}</b></div>
                      <div style={{ color: "var(--muted-foreground)" }}>From {preview.from_name ?? ""} {preview.from_email ? `<${preview.from_email}>` : ""}</div>
                    </div>
                    {preview.html_body ? (
                      <iframe title="Email preview" sandbox="" srcDoc={preview.html_body} style={{ width: "100%", height: 260, border: "0.5px solid var(--border)", borderRadius: 8, background: "#fff", marginTop: 10 }} />
                    ) : null}
                    <div style={{ fontSize: 11.5, color: "var(--muted-foreground)", margin: "10px 0 4px" }}>Recipients · {preview.total.toLocaleString()}{preview.total > preview.recipients.length ? ` (first ${preview.recipients.length} shown)` : ""}</div>
                    <div style={{ maxHeight: 140, overflowY: "auto", fontSize: 12, background: "var(--background)", borderRadius: 8, border: "0.5px solid var(--border)" }}>
                      {preview.recipients.map((r) => (
                        <div key={r.email} style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "4px 10px", borderBottom: "0.5px solid var(--border)" }}>
                          <span>{r.name || r.email}</span><span style={{ color: "var(--muted-foreground)" }}>{r.company ? `${r.company} · ` : ""}{r.email}</span>
                        </div>
                      ))}
                    </div>
                    <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
                      {canApprove && !b.on_hold ? <button type="button" onClick={() => void act(b.id, { action: "hold" }).then(() => setReviewing(null))} style={btn}>Hold batch</button> : null}
                      <button type="button" onClick={() => void act(b.id, { action: "review" }).then(() => setReviewing(null))} style={btn}>{b.send_state === "manual" ? "Mark reviewed" : "Reviewed, keep schedule"}</button>
                      {canApprove ? <button type="button" onClick={() => { setReviewing(null); void release(b.id); }} style={primary}>Send now</button> : null}
                    </div>
                  </>
                )}
              </div>
            ) : null}
          </div>
        ))}
      </div>
      {scheduleFor ? <SchedulePanel sequenceId={scheduleFor.id} sequenceName={scheduleFor.name} onClose={() => setScheduleFor(null)} onSaved={() => undefined} /> : null}
    </div>
  );
}
