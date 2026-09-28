"use client";

/**
 * Auto sequence on a Share Project record: the live sequence card (steps, status, events,
 * who is alerted, Pause / Resume / Stop / Mark as replied), or — when opened — the setup
 * form. Opens and clicks are tracked for iCapOS sends only; replies are marked by staff;
 * moving the record to a meeting stage stops the sequence.
 */
import { useCallback, useEffect, useState } from "react";
import { ALERT_EVENTS, EVENT_LABEL, type AlertEvent, type SequenceEventKind, type SequenceStep, type StopEvent } from "@/lib/ir/sequence-templates";
import type { IrStage } from "@/lib/ir/types";

type Enrollment = {
  id: string; template: string; steps: SequenceStep[]; via: "icapos" | "gmail"; manager_id: string; watcher_ids: string[];
  notify_events: AlertEvent[]; notify_email: boolean; stop_on: StopEvent[]; status: "running" | "paused" | "stopped" | "completed";
  stop_reason: string | null; next_step: number; started_at: string; next_send_at: string | null; last_error: string | null;
};
type Event = { id: string; kind: SequenceEventKind; step: number | null; detail: string | null; created_at: string };
type Payload = { enrollment: Enrollment | null; events: Event[]; templates: Record<string, { name: string; steps: SequenceStep[] }>; setupNeeded: boolean };

const inp = "w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-[12.5px] focus:border-indigo-400 focus:outline-none";
const fmt = (iso: string) => new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
const fmtDay = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
const STATUS: Record<Enrollment["status"], string> = { running: "bg-emerald-50 text-emerald-700", paused: "bg-amber-50 text-amber-700", stopped: "bg-slate-100 text-slate-600", completed: "bg-indigo-50 text-indigo-700" };

export function SequencePanel({ matchId, stage, staff, meId, defaultManager, onePagerUrl, open, onClose, onChange }: {
  matchId: string; stage: IrStage; staff: Array<{ id: string; name: string }>; meId: string; defaultManager: string | null; onePagerUrl: string | null;
  open: boolean; onClose: () => void; onChange: () => Promise<void>;
}) {
  const [data, setData] = useState<Payload | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const r = await fetch(`/api/admin/ir/matches/${matchId}/sequence`);
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { setErr(j.error ?? "Couldn't load the sequence."); return; }
    setData(j); setErr(null);
  }, [matchId]);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch, then set
  useEffect(() => { void load(); }, [load]);

  async function act(action: "pause" | "resume" | "stop" | "reply") {
    setBusy(true); setErr(null);
    const r = await fetch(`/api/admin/ir/matches/${matchId}/sequence`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) { setErr(j.error ?? "Couldn't update the sequence."); return; }
    await load(); await onChange();
  }

  if (!data) return err && open ? <p className="mb-3 text-[12.5px] text-rose-600">{err}</p> : null;
  const e = data.enrollment;
  const live = e && (e.status === "running" || e.status === "paused");
  const name = (id: string) => staff.find((s) => s.id === id)?.name ?? "Staff";

  if (data.setupNeeded) return open ? (
    <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[12.5px] text-amber-900">
      Auto sequences need two new tables. Run <code className="rounded bg-white px-1">supabase/migrations/20260928100000_ir_sequences.sql</code> in the Supabase SQL editor, then reload this page.
      <button type="button" onClick={onClose} className="ml-2 underline">Close</button>
    </div>
  ) : null;

  if (e && (live || !open)) {
    if (!live && !open) return null;
    const counts = data.events.reduce<Record<string, number>>((m, x) => { m[x.kind] = (m[x.kind] ?? 0) + 1; return m; }, {});
    return (
      <div className="mb-3 rounded-xl border border-indigo-200 bg-indigo-50/40 p-4 text-[12.5px]">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-[14px] font-semibold text-slate-900"><i className="ti ti-bolt" aria-hidden="true" /> Auto sequence · {data.templates[e.template]?.name ?? "Custom"} ({e.steps.length} steps)</p>
          <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS[e.status]}`}>{e.status[0].toUpperCase() + e.status.slice(1)}{e.stop_reason ? `: ${e.stop_reason}` : ""}</span>
          {open ? <button type="button" onClick={onClose} aria-label="Close" className="ml-auto text-slate-400 hover:text-slate-700"><i className="ti ti-x" aria-hidden="true" /></button> : null}
        </div>
        {e.last_error ? <p className="mt-2 rounded-md bg-rose-50 px-2 py-1 text-rose-700">Last send failed: {e.last_error}</p> : null}
        <ol className="mt-3 space-y-1.5">
          {e.steps.map((s, i) => {
            const sent = data.events.some((x) => x.kind === "sent" && x.step === i);
            const next = live && i === e.next_step;
            const cancelled = !live && !sent;
            const when = new Date(new Date(e.started_at).getTime() + s.day * 86_400_000).toISOString();
            return (
              <li key={i} className="grid grid-cols-[22px_56px_1fr_auto] items-center gap-2">
                <span className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${sent ? "bg-emerald-500 text-white" : next ? "bg-indigo-600 text-white" : "border border-slate-300 text-slate-400"}`}>{sent ? "✓" : i + 1}</span>
                <span className="text-[11.5px] text-slate-500">Day {s.day}</span>
                <span className={`truncate ${cancelled ? "text-slate-400 line-through" : "text-slate-800"}`}>{s.subject}</span>
                <span className="text-[11.5px] text-slate-500">{sent ? "Sent" : cancelled ? "Cancelled" : next && e.next_send_at ? `Sends ${fmtDay(e.next_send_at)}` : fmtDay(when)}</span>
              </li>
            );
          })}
        </ol>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {(["open", "click", "reply", "meeting"] as const).map((k) => counts[k] ? <span key={k} className="rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[11.5px] text-slate-700">{EVENT_LABEL[k]} ×{counts[k]}</span> : null)}
          <span className="rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[11.5px] text-slate-700">Sending with {e.via === "gmail" ? "Gmail (opens not tracked)" : "iCapOS"}</span>
        </div>
        <p className="mt-2 border-t border-dashed border-slate-300 pt-2 text-slate-600"><i className="ti ti-bell" aria-hidden="true" /> Alerting <b>{name(e.manager_id)}</b>{e.watcher_ids.length ? ` and ${e.watcher_ids.map(name).join(", ")}` : ""} in iCapOS{e.notify_email ? " and by email" : ""} when the investor: {e.notify_events.map((k) => ALERT_EVENTS.find((a) => a.key === k)?.label.toLowerCase()).join(", ") || "nothing (alerts off)"}.</p>
        {data.events.length ? <ul className="mt-2 space-y-0.5 text-[12px] text-slate-600">{data.events.slice(0, 6).map((x) => <li key={x.id}><span className="mr-2 tabular-nums text-slate-400">{fmt(x.created_at)}</span>{EVENT_LABEL[x.kind]}{x.step != null ? ` · step ${x.step + 1}` : ""}{x.detail ? ` · ${x.detail}` : ""}</li>)}</ul> : null}
        {err ? <p className="mt-2 text-rose-600">{err}</p> : null}
        {live ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {e.status === "running" ? <button type="button" disabled={busy} onClick={() => void act("pause")} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 hover:bg-slate-50 disabled:opacity-60">Pause</button>
              : <button type="button" disabled={busy} onClick={() => void act("resume")} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 hover:bg-slate-50 disabled:opacity-60">Resume</button>}
            <button type="button" disabled={busy} onClick={() => void act("reply")} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 hover:bg-slate-50 disabled:opacity-60">Mark as replied</button>
            <button type="button" disabled={busy} onClick={() => void act("stop")} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-rose-700 hover:bg-rose-50 disabled:opacity-60">Stop sequence</button>
          </div>
        ) : null}
      </div>
    );
  }

  if (!open) return null;
  return <SetupForm matchId={matchId} stage={stage} staff={staff} meId={meId} defaultManager={defaultManager} onePagerUrl={onePagerUrl} templates={data.templates} onClose={onClose} onStarted={async () => { await load(); await onChange(); }} />;
}

function SetupForm({ matchId, stage, staff, meId, defaultManager, onePagerUrl, templates, onClose, onStarted }: {
  matchId: string; stage: IrStage; staff: Array<{ id: string; name: string }>; meId: string; defaultManager: string | null; onePagerUrl: string | null;
  templates: Payload["templates"]; onClose: () => void; onStarted: () => Promise<void>;
}) {
  const keys = Object.keys(templates);
  const [template, setTemplate] = useState(stage === "matched" ? keys[0] : keys.find((k) => k === "warm_follow_up") ?? keys[0]);
  const [steps, setSteps] = useState<SequenceStep[]>(templates[template]?.steps ?? []);
  const [skipFirst, setSkipFirst] = useState(false);
  const [onePager, setOnePager] = useState(!!onePagerUrl);
  const [via, setVia] = useState<"icapos" | "gmail">("icapos");
  const [manager, setManager] = useState(defaultManager ?? meId);
  const [watcher, setWatcher] = useState("");
  const [events, setEvents] = useState<AlertEvent[]>(["open", "click", "reply", "meeting"]);
  const [notifyEmail, setNotifyEmail] = useState(true);
  const [stopOn, setStopOn] = useState<StopEvent[]>(["reply", "meeting"]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const setStep = (i: number, p: Partial<SequenceStep>) => setSteps((s) => s.map((x, j) => (j === i ? { ...x, ...p } : x)));

  async function start() {
    setBusy(true); setErr(null);
    const r = await fetch(`/api/admin/ir/matches/${matchId}/sequence`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
      action: "start", template, steps, via, includeOnePager: onePager, skipFirst, managerId: manager, watcherIds: watcher ? [watcher] : [], notifyEvents: events, notifyEmail, stopOn,
    }) });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) { setErr(j.error ?? "Couldn't start the sequence."); return; }
    await onStarted();
  }

  return (
    <div className="mb-3 rounded-xl border border-indigo-200 bg-white p-4 text-[12.5px] shadow-sm">
      <div className="mb-3 flex items-center gap-2">
        <p className="text-[14px] font-semibold text-slate-900"><i className="ti ti-bolt" aria-hidden="true" /> Start auto sequence</p>
        <button type="button" onClick={onClose} aria-label="Close" className="ml-auto text-slate-400 hover:text-slate-700"><i className="ti ti-x" aria-hidden="true" /></button>
      </div>
      <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500" htmlFor="seq-template">Sequence</label>
      <select id="seq-template" value={template} onChange={(e) => { setTemplate(e.target.value); setSteps(templates[e.target.value]?.steps ?? []); }} className={inp}>
        {keys.map((k) => <option key={k} value={k}>{templates[k].name} · {templates[k].steps.length} steps</option>)}
      </select>
      <p className="mb-1 mt-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Steps <span className="font-normal normal-case text-slate-400">· {"{first}"} and {"{founder}"} are filled in when each email is sent</span></p>
      <div className="space-y-2">
        {steps.map((s, i) => (
          <div key={i} className={`rounded-lg border border-slate-200 p-2 ${skipFirst && i === 0 ? "opacity-50" : ""}`}>
            <div className="flex items-center gap-2">
              <span className="text-[11.5px] text-slate-500">Day</span>
              <input type="number" min={0} max={365} value={s.day} onChange={(e) => setStep(i, { day: Number(e.target.value) || 0 })} className="w-16 rounded-md border border-slate-200 px-2 py-1 text-[12.5px]" aria-label={`Step ${i + 1} day`} />
              <input value={s.subject} onChange={(e) => setStep(i, { subject: e.target.value })} className={inp} aria-label={`Step ${i + 1} subject`} />
              <button type="button" disabled={steps.length <= 1} onClick={() => setSteps((x) => x.filter((_, j) => j !== i))} aria-label={`Remove step ${i + 1}`} className="rounded-md border border-slate-200 px-2 py-1 text-slate-500 hover:text-rose-600 disabled:opacity-40"><i className="ti ti-x" aria-hidden="true" /></button>
            </div>
            <textarea value={s.body} onChange={(e) => setStep(i, { body: e.target.value })} rows={3} className={`${inp} mt-1.5`} aria-label={`Step ${i + 1} message`} />
          </div>
        ))}
      </div>
      {steps.length < 10 ? <button type="button" onClick={() => setSteps((x) => [...x, { day: (x[x.length - 1]?.day ?? 0) + 4, subject: "Checking in: {founder}", body: "Hi {first},\n\nChecking in on {founder}.\n\nBest," }])} className="mt-1.5 text-[12.5px] text-indigo-700 hover:underline">+ Add step</button> : null}
      <div className="mt-3 space-y-1.5 text-slate-700">
        {stage !== "matched" ? <label className="flex items-center gap-2"><input type="checkbox" checked={skipFirst} onChange={(e) => setSkipFirst(e.target.checked)} /> Skip step 1 (the intro was already sent)</label> : null}
        {onePagerUrl ? <label className="flex items-center gap-2"><input type="checkbox" checked={onePager} onChange={(e) => setOnePager(e.target.checked)} /> Link the founder&rsquo;s one-pager in the first email</label> : null}
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div>
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Stop when the investor</p>
          {(["reply", "meeting"] as const).map((k) => <label key={k} className="mr-3 inline-flex items-center gap-1.5"><input type="checkbox" checked={stopOn.includes(k)} onChange={(e) => setStopOn((x) => e.target.checked ? [...x, k] : x.filter((y) => y !== k))} /> {k === "reply" ? "Replies" : "Books a meeting"}</label>)}
        </div>
        <div>
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Send with</p>
          {(["icapos", "gmail"] as const).map((k) => <label key={k} className="mr-3 inline-flex items-center gap-1.5"><input type="radio" name="seq-via" checked={via === k} onChange={() => setVia(k)} /> {k === "icapos" ? "iCapOS" : "Gmail"}</label>)}
          {via === "gmail" ? <p className="mt-1 text-[11.5px] text-amber-700">Opens and clicks can&rsquo;t be tracked on Gmail sends, so those alerts won&rsquo;t fire.</p> : null}
        </div>
      </div>
      <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Alert the account manager</p>
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="text-[11.5px] text-slate-500">Account manager<select value={manager} onChange={(e) => setManager(e.target.value)} className={`${inp} mt-0.5`}>{staff.map((s) => <option key={s.id} value={s.id}>{s.id === meId ? `${s.name} (me)` : s.name}</option>)}</select></label>
          <label className="text-[11.5px] text-slate-500">Also alert (optional)<select value={watcher} onChange={(e) => setWatcher(e.target.value)} className={`${inp} mt-0.5`}><option value="">No one else</option>{staff.filter((s) => s.id !== manager).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
        </div>
        <p className="mb-1 mt-2 text-[11.5px] text-slate-500">When the investor:</p>
        <div className="flex flex-wrap gap-x-4 gap-y-1">{ALERT_EVENTS.map((a) => <label key={a.key} className="inline-flex items-center gap-1.5"><input type="checkbox" checked={events.includes(a.key)} onChange={(e) => setEvents((x) => e.target.checked ? [...x, a.key] : x.filter((y) => y !== a.key))} /> {a.label}</label>)}</div>
        <label className="mt-2 inline-flex items-center gap-1.5"><input type="checkbox" checked={notifyEmail} onChange={(e) => setNotifyEmail(e.target.checked)} /> Also email the alert (always shown in iCapOS notifications)</label>
      </div>
      {err ? <p className="mt-2 text-rose-600">{err}</p> : null}
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" disabled={busy || !steps.length} onClick={() => void start()} className="rounded-lg bg-indigo-600 px-4 py-1.5 font-semibold text-white hover:bg-indigo-700 disabled:opacity-60">{busy ? "Starting…" : steps[skipFirst ? 1 : 0]?.day === 0 ? "Start and send step " + (skipFirst ? 2 : 1) + " now" : "Start sequence"}</button>
        <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 px-3 py-1.5 text-slate-600 hover:bg-slate-50">Discard</button>
      </div>
    </div>
  );
}
