"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { FounderJourneyState, JourneyStage } from "@/lib/founder-journey/types";
import { JOURNEY_STAGES } from "@/lib/founder-journey/types";
import { buildCompanyFilteredHref } from "@/lib/admin/company-workspace-types";

const STAGE_META: Record<JourneyStage, { label: string; blurb: string }> = {
  initialize: { label: "Onboarding", blurb: "Company profile & onboarding" },
  qualify: { label: "Preparation", blurb: "Readiness, documents & stage approval" },
  deploy: { label: "Marketing", blurb: "Go-to-market & deal room" },
  optimize: { label: "Closing", blurb: "Investor engagement & close" },
};

type Gate = {
  key: string;
  label: string;
  detail: string;
  met: boolean;
  why: string;
  points: string[];
  action?: { label: string; href: string };
};

function approvalBadge(status: FounderJourneyState["approvalStatus"]) {
  switch (status) {
    case "pending":
      return { label: "Approval pending", cls: "bg-amber-50 text-amber-700 ring-amber-200" };
    case "approved":
      return { label: "Stage approved", cls: "bg-emerald-50 text-emerald-700 ring-emerald-200" };
    case "rejected":
      return { label: "Changes requested", cls: "bg-red-50 text-red-700 ring-red-200" };
    default:
      return { label: "No approval requested", cls: "bg-slate-100 text-slate-600 ring-slate-200" };
  }
}

function buildGates(journey: FounderJourneyState, companyId: string): Gate[] {
  const c = journey.conditions;
  const readinessDetail =
    c.readinessScore != null ? `Score ${c.readinessScore} (needs ≥ 75)` : "No readiness score yet";
  return [
    {
      key: "onboarding",
      label: "Onboarding complete",
      detail: "Company profile, funding info, pitch deck",
      met: c.onboardingComplete,
      why: c.onboardingComplete
        ? "All founder-actionable onboarding steps are complete."
        : "The founder has not finished the company profile, funding info, or pitch-deck steps.",
      points: c.onboardingComplete
        ? ["Company profile complete", "Funding info provided", "Pitch deck uploaded"]
        : ["Ask the founder to finish their onboarding steps", "Company profile, funding info, and pitch deck are required"],
      action: c.onboardingComplete ? undefined : { label: "Review company", href: `/admin/companies/${companyId}` },
    },
    {
      key: "readiness",
      label: "Readiness qualified",
      detail: readinessDetail,
      met: c.readinessQualified,
      why: c.readinessQualified
        ? "Readiness clears the 75 qualify threshold."
        : "Readiness is below the 75 threshold needed to qualify.",
      points: c.readinessQualified
        ? ["Above the qualify threshold", "Documents drive the readiness score"]
        : ["Upload the remaining required documents", "Generate a diligence report to lift the score"],
      action: c.readinessQualified ? undefined : { label: "Open reports", href: `/admin/reports?companyId=${companyId}&reportType=due_diligence` },
    },
    {
      key: "docs",
      label: "Required documents uploaded",
      detail: "Qualify-stage document set",
      met: c.requiredDocsUploaded,
      why: c.requiredDocsUploaded
        ? "The required Qualify-stage document set is present."
        : "One or more required Qualify-stage documents are missing.",
      points: c.requiredDocsUploaded
        ? ["Core documents present", "Pitch deck present"]
        : ["Identify the missing document categories", "Request them from the founder", "Confirm uploads in the data room"],
      action: c.requiredDocsUploaded ? undefined : { label: "Open documents", href: `/admin/companies/${companyId}#qualify` },
    },
    {
      key: "dealroom",
      label: "Deal room created",
      detail: "Needed for Deploy",
      met: c.hasDealRoom,
      why: c.hasDealRoom
        ? "A deal room exists to coordinate the raise."
        : "Deploy assumes an active deal room to coordinate the raise. None exists yet, which blocks progress into Optimize.",
      points: c.hasDealRoom
        ? ["Deal room is active"]
        : ["Open Deal Rooms", "Create a room and attach this company", "Invite the founder and internal deal team", "Load the data-room documents"],
      action: { label: c.hasDealRoom ? "Open Deal Rooms" : "Create deal room", href: buildCompanyFilteredHref("/admin/deal-rooms", companyId) },
    },
    {
      key: "interest",
      label: "Investor interest logged",
      detail: "Signal for Optimize",
      met: c.hasInvestorInterest,
      why: c.hasInvestorInterest
        ? "At least one investor interest has been recorded."
        : "No investor interest is recorded yet. Optimize is about converting demand, so at least one logged interest is required.",
      points: c.hasInvestorInterest
        ? ["Interest recorded"]
        : ["Run investor matching for the company", "Surface it to matched investors", "Send a targeted intro campaign", "Log the first expressed interest"],
      action: { label: "Open matching", href: buildCompanyFilteredHref("/admin/matching", companyId) },
    },
  ];
}

type ReminderStatus = {
  gateKey: string;
  state: "resolved" | "paused" | "sent" | "scheduled";
  paused: boolean;
  sendsCount: number;
  lastSentAt: string | null;
  nextSendAt: string | null;
  subject: string;
};

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  } catch {
    return "—";
  }
}

// Compact reminder pill shown next to a pending gate.
function ReminderPill({ r }: { r: ReminderStatus | undefined }) {
  if (!r) return null;
  const map = {
    sent: { cls: "bg-emerald-50 text-emerald-700", icon: "ti-circle-check", text: `Reminder sent · ${fmtDate(r.lastSentAt)}` },
    scheduled: { cls: "bg-sky-50 text-sky-700", icon: "ti-clock", text: "Reminder on · scheduled" },
    paused: { cls: "bg-amber-50 text-amber-800", icon: "ti-player-pause", text: "Reminder paused" },
    resolved: { cls: "bg-slate-100 text-slate-500", icon: "ti-bell-off", text: "Reminders stopped" },
  } as const;
  const m = map[r.state];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${m.cls}`}>
      <i className={`ti ${m.icon}`} aria-hidden="true" /> {m.text}
    </span>
  );
}

export function FounderJourneyPanel({
  journey,
  companyId,
}: Readonly<{ journey: FounderJourneyState; companyId: string }>) {
  const { stage, stageIndex, approvalStatus, approvalFeedback, pendingApproval } = journey;
  const badge = approvalBadge(approvalStatus);
  const gates = buildGates(journey, companyId);
  const pending = gates.filter((g) => !g.met);
  const [openKey, setOpenKey] = useState<string | null>(null);
  const active = gates.find((g) => g.key === openKey) ?? null;

  const [reminders, setReminders] = useState<Record<string, ReminderStatus>>({});
  const [reminderBusy, setReminderBusy] = useState<string | null>(null);
  const [reminderMsg, setReminderMsg] = useState<string | null>(null);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [schedDate, setSchedDate] = useState("");
  const [schedTime, setSchedTime] = useState("09:00");
  const [schedRecurring, setSchedRecurring] = useState(true);

  const loadReminders = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/companies/${companyId}/gate-reminders`);
      const j = await res.json().catch(() => ({}));
      if (res.ok && Array.isArray(j.gates)) {
        const byKey: Record<string, ReminderStatus> = {};
        for (const g of j.gates as ReminderStatus[]) byKey[g.gateKey] = g;
        setReminders(byKey);
      }
    } catch { /* reminders are best-effort in the UI */ }
  }, [companyId]);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- async fetch sets state after mount
  useEffect(() => { void loadReminders(); }, [loadReminders]);

  async function reminderAction(gateKey: string, action: "send-now" | "pause" | "resume" | "schedule", extra?: { sendAt: string; recurring: boolean }) {
    setReminderBusy(gateKey + action);
    setReminderMsg(null);
    try {
      const res = await fetch(`/api/admin/companies/${companyId}/gate-reminders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gateKey, action, ...extra }),
      });
      const j = await res.json().catch(() => ({}));
      if (res.ok) {
        setReminderMsg(
          action === "send-now" ? "Reminder sent." :
          action === "pause" ? "Reminder paused." :
          action === "schedule" ? "Reminder scheduled." : "Reminder resumed.",
        );
        if (action === "schedule") setScheduleOpen(false);
        await loadReminders();
      } else {
        setReminderMsg(j.error ?? "Something went wrong.");
      }
    } finally {
      setReminderBusy(null);
    }
  }

  function submitSchedule(gateKey: string) {
    if (!schedDate || !schedTime) { setReminderMsg("Pick a date and time first."); return; }
    const when = new Date(`${schedDate}T${schedTime}`);
    if (Number.isNaN(when.getTime())) { setReminderMsg("That date/time isn't valid."); return; }
    void reminderAction(gateKey, "schedule", { sendAt: when.toISOString(), recurring: schedRecurring });
  }

  const activeReminder = active ? reminders[active.key] : undefined;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-[var(--shadow-card)]">
      {/* Stepper */}
      <div className="mb-4 flex items-center">
        {JOURNEY_STAGES.map((s, i) => {
          const done = i < stageIndex;
          const current = i === stageIndex;
          return (
            <div key={s} className="flex flex-1 items-center last:flex-none">
              <div className="flex flex-col items-center text-center">
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${
                    current
                      ? "bg-indigo-600 text-white ring-4 ring-indigo-100"
                      : done
                        ? "bg-emerald-500 text-white"
                        : "bg-slate-100 text-slate-400"
                  }`}
                >
                  {done ? <i className="ti ti-check" aria-hidden="true" /> : i + 1}
                </div>
                <p className={`mt-1.5 text-[11px] font-semibold ${current ? "text-indigo-700" : done ? "text-slate-700" : "text-slate-400"}`}>
                  {STAGE_META[s].label}
                </p>
              </div>
              {i < JOURNEY_STAGES.length - 1 ? (
                <div className={`mx-1 h-0.5 flex-1 rounded ${i < stageIndex ? "bg-emerald-400" : "bg-slate-200"}`} />
              ) : null}
            </div>
          );
        })}
      </div>

      {/* Current stage summary */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2.5">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Current stage</p>
          <p className="text-sm font-bold text-slate-900">{STAGE_META[stage].label}</p>
          <p className="text-[11px] text-slate-500">{STAGE_META[stage].blurb}</p>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ${badge.cls}`}>{badge.label}</span>
      </div>

      {pendingApproval ? (
        <div className="mb-3 rounded-lg border-l-[3px] border-amber-400 bg-amber-50 px-3 py-2 text-[11.5px] text-amber-900">
          <b>Action needed:</b> the founder has requested approval to advance from <b>{STAGE_META[stage].label}</b>. Review and approve/reject in the stage-approval queue.
        </div>
      ) : null}

      {approvalStatus === "rejected" && approvalFeedback ? (
        <div className="mb-3 rounded-lg border-l-[3px] border-red-400 bg-red-50 px-3 py-2 text-[11.5px] text-red-900">
          <b>Feedback to founder:</b> {approvalFeedback}
        </div>
      ) : null}

      {/* Gates — click to open solution popup */}
      <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
        Stage gates <span className="font-normal normal-case tracking-normal text-slate-400">— click a gate for its solution</span>
      </p>
      <div className="grid gap-x-6 gap-y-0.5 sm:grid-cols-2">
        {gates.map((g) => (
          <button
            key={g.key}
            type="button"
            onClick={() => { setOpenKey(g.key); setScheduleOpen(false); setReminderMsg(null); }}
            className="flex items-start gap-2.5 rounded-lg px-2 py-1.5 text-left transition hover:bg-slate-50"
          >
            <span
              className={`mt-0.5 flex h-4 w-4 flex-none items-center justify-center rounded-full text-[10px] font-bold ${
                g.met ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-600"
              }`}
              aria-hidden
            >
              {g.met ? <i className="ti ti-check" aria-hidden="true" /> : <i className="ti ti-x" aria-hidden="true" />}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-xs font-medium text-slate-800">{g.label}</span>
              <span className="block text-[11px] text-slate-500">{g.detail}</span>
              {!g.met ? <span className="mt-1 block"><ReminderPill r={reminders[g.key]} /></span> : null}
            </span>
            <span className="mt-0.5 flex-none text-[11px] font-medium text-slate-400">
              {g.met ? "Details" : "Resolve"} ›
            </span>
          </button>
        ))}
      </div>

      {pending.length > 0 ? (
        <p className="mt-2 text-[11px] text-slate-500">
          <span className="font-semibold text-red-600">{pending.length} pending:</span>{" "}
          {pending.map((p) => p.label).join(", ")} — click to resolve.
        </p>
      ) : (
        <p className="mt-2 rounded-lg bg-emerald-50 px-3 py-2 text-[11.5px] text-emerald-800">
          All tracked gates are met. {pendingApproval ? "Awaiting your stage approval." : "Ready to progress."}
        </p>
      )}

      {/* Solution popup */}
      {active ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => setOpenKey(null)}
        >
          <div
            className="w-full max-w-md rounded-xl bg-white p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-2 flex items-center justify-between">
              <span
                className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                  active.met ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
                }`}
              >
                {active.met ? "Satisfied" : "Blocking"}
              </span>
              <button
                type="button"
                aria-label="Close"
                onClick={() => setOpenKey(null)}
                className="text-slate-400 hover:text-slate-700"
              >
                <i className="ti ti-x" aria-hidden="true" />
              </button>
            </div>
            <h3 className="text-base font-semibold text-slate-900">{active.label}</h3>
            <p className="mt-1 text-[13px] leading-relaxed text-slate-600">{active.why}</p>

            <p className="mt-3 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              {active.met ? "Evidence" : "Steps to resolve"}
            </p>
            <ul className="mt-1 space-y-1.5">
              {active.points.map((p, i) => (
                <li key={p} className="flex items-start gap-2 text-[13px] text-slate-800">
                  {active.met ? (
                    <span className="mt-0.5 flex-none text-emerald-600"><i className="ti ti-check" aria-hidden="true" /></span>
                  ) : (
                    <span className="mt-0.5 flex h-4 w-4 flex-none items-center justify-center rounded-full border border-slate-300 bg-slate-50 text-[10px] text-slate-500">
                      {i + 1}
                    </span>
                  )}
                  <span>{p}</span>
                </li>
              ))}
            </ul>

            {!active.met ? (
              <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
                <div className="mb-1.5 flex items-center gap-2">
                  <i className="ti ti-robot text-[14px] text-indigo-600" aria-hidden="true" />
                  <span className="text-[11.5px] font-semibold text-slate-800">Reminder automation</span>
                  <span className="text-[10.5px] text-slate-500">· every 3 days until resolved · from iCapOS</span>
                </div>
                <p className="text-[11.5px] text-slate-600"><b>Subject:</b> {activeReminder?.subject ?? `Reminder: ${active.label.toLowerCase()}`}</p>
                <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-500">
                  <span><i className="ti ti-send text-emerald-600" aria-hidden="true" /> Last sent {fmtDate(activeReminder?.lastSentAt ?? null)}</span>
                  <span><i className="ti ti-clock text-sky-600" aria-hidden="true" /> Next {activeReminder?.paused ? "paused" : fmtDate(activeReminder?.nextSendAt ?? null)}</span>
                  <span>{activeReminder?.sendsCount ?? 0} sent so far</span>
                </div>
                <div className="mt-2.5 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={reminderBusy !== null}
                    onClick={() => void reminderAction(active.key, "send-now")}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-[11.5px] font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
                  >
                    <i className="ti ti-send" aria-hidden="true" /> {reminderBusy === active.key + "send-now" ? "Sending…" : "Send now"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setScheduleOpen((v) => !v)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-sky-200 bg-sky-50 px-3 py-1.5 text-[11.5px] font-semibold text-sky-700 hover:bg-sky-100"
                  >
                    <i className="ti ti-calendar-plus" aria-hidden="true" /> Schedule
                  </button>
                  <button
                    type="button"
                    disabled={reminderBusy !== null}
                    onClick={() => void reminderAction(active.key, activeReminder?.paused ? "resume" : "pause")}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-[11.5px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                  >
                    <i className={`ti ${activeReminder?.paused ? "ti-player-play" : "ti-player-pause"}`} aria-hidden="true" /> {activeReminder?.paused ? "Resume" : "Pause"}
                  </button>
                  {reminderMsg ? <span className="self-center text-[11px] font-medium text-indigo-700">{reminderMsg}</span> : null}
                </div>

                {scheduleOpen ? (
                  <div className="mt-2.5 rounded-lg border border-slate-200 bg-white p-2.5">
                    <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">Schedule this reminder <span className="font-normal normal-case text-slate-400">· your local time</span></div>
                    <div className="flex flex-wrap items-center gap-2">
                      <input type="date" value={schedDate} onChange={(e) => setSchedDate(e.target.value)} className="rounded border border-slate-300 px-2 py-1 text-[11.5px]" />
                      <input type="time" value={schedTime} onChange={(e) => setSchedTime(e.target.value)} className="rounded border border-slate-300 px-2 py-1 text-[11.5px]" />
                      <button
                        type="button"
                        disabled={reminderBusy !== null}
                        onClick={() => submitSchedule(active.key)}
                        className="rounded-lg bg-[#5B2AD6] px-3 py-1.5 text-[11.5px] font-semibold text-white hover:opacity-90 disabled:opacity-50"
                      >
                        {reminderBusy === active.key + "schedule" ? "Scheduling…" : "Set schedule"}
                      </button>
                    </div>
                    <label className="mt-2 flex items-center gap-2 text-[11px] text-slate-600">
                      <input type="checkbox" checked={schedRecurring} onChange={(e) => setSchedRecurring(e.target.checked)} /> Then keep repeating every 3 days until resolved
                    </label>
                  </div>
                ) : null}
              </div>
            ) : null}

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpenKey(null)}
                className="rounded-lg border border-slate-300 px-3.5 py-2 text-[13px] font-medium text-slate-700 hover:bg-slate-50"
              >
                Close
              </button>
              {active.action ? (
                <Link
                  href={active.action.href}
                  className="rounded-lg bg-indigo-600 px-3.5 py-2 text-[13px] font-semibold text-white hover:bg-indigo-700"
                >
                  {active.action.label} →
                </Link>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
