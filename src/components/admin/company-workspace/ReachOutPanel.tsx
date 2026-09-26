"use client";

import { useState } from "react";
import { arrivalLabel, type UsZone } from "@/lib/founder-outreach/us-time-zone";

type Via = "icapos" | "gmail";

// Carried over from ReachOutCard, which this panel replaced: being investor-ready
// and having investor access are different things, and staff need to be able to
// say so without writing it out each time.
const UPGRADE_LINE =
  "\n\nWhen you're ready to reach investors, investor access is available on a paid plan — reply and we'll walk you through the options.";

/**
 * "Reach out to founder" — drafts an email from the stage's DIAGNOSIS (not just
 * the item labels, which is why the old drafts could only say "these are still
 * pending") and sends it either with iCapOS or from the staff member's own Gmail.
 *
 * iCapOS is the default: it needs no Google connection, replies come back to the
 * sender, and the send is logged on the company timeline. Gmail sends personally
 * and is the only route with a Drafts folder to save into.
 */
export function ReachOutPanel({
  companyId,
  founderName,
  founderEmail,
  stageLabel,
  pendingItems,
  facts = [],
  situation = "blocking",
  founderCanDistribute = true,
}: Readonly<{
  companyId: string;
  founderName: string;
  founderEmail: string | null;
  stageLabel: string;
  pendingItems: string[];
  /** The stage's diagnosis as plain lines — score, gaps, ranked fixes. */
  facts?: string[];
  situation?: "blocking" | "cleared" | "locked-near" | "locked-far";
  /** False when the founder's plan doesn't include investor access — offers the
   *  upgrade mention. */
  founderCanDistribute?: boolean;
}>) {
  const [open, setOpen] = useState(false);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [appendSignature, setAppendSignature] = useState(true);
  const [alsoNudge, setAlsoNudge] = useState(false);
  const [includeUpgrade, setIncludeUpgrade] = useState(false);
  const [via, setVia] = useState<Via>("icapos");
  const [busy, setBusy] = useState<null | "draft" | "save" | "send">(null);
  const [notice, setNotice] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  // Schedule for later: the same control as the stage reminders (date and time in
  // the staff member's local time), plus when it lands in the founder's zone.
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [schedDate, setSchedDate] = useState("");
  const [schedTime, setSchedTime] = useState("09:00");
  const [scheduling, setScheduling] = useState(false);
  const [zone, setZone] = useState<(UsZone & { stateName: string }) | null>(null);

  async function loadDraft() {
    setBusy("draft");
    setNotice(null);
    try {
      const res = await fetch(`/api/admin/companies/${companyId}/reach-out`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "draft", items: pendingItems, stage: stageLabel, situation, facts }),
      });
      const j = await res.json().catch(() => ({}));
      if (res.ok) {
        setSubject(j.subject ?? "");
        setBody(j.body ?? "");
      } else {
        setNotice({ kind: "err", text: j.error ?? "Could not draft the email." });
      }
    } finally {
      setBusy(null);
    }
  }

  async function act(action: "save-draft" | "send") {
    const label = via === "icapos" ? "with iCapOS" : "from your Gmail";
    if (action === "send" && !window.confirm(`Send this email to ${founderEmail} ${label} now?`)) return;
    setBusy(action === "send" ? "send" : "save");
    setNotice(null);
    try {
      const res = await fetch(`/api/admin/companies/${companyId}/reach-out`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, subject, body, appendSignature, alsoNudge, via }),
      });
      const j = await res.json().catch(() => ({}));
      if (res.ok) {
        setNotice({
          kind: "ok",
          text:
            action !== "send"
              ? "Saved to your Gmail Drafts."
              : j.channel === "notification"
                // Resend isn't configured, so it went in-app rather than silently nowhere.
                ? "No email provider configured — delivered as an in-app notification instead."
                : via === "icapos"
                  ? "Sent with iCapOS. Replies come to you."
                  : "Sent from your Gmail.",
        });
      } else {
        setNotice({ kind: "err", text: j.error ?? "Something went wrong." });
      }
    } finally {
      setBusy(null);
    }
  }

  function toggleUpgrade(next: boolean) {
    setIncludeUpgrade(next);
    setBody((b) => {
      const stripped = b.replace(UPGRADE_LINE, "");
      return next ? stripped + UPGRADE_LINE : stripped;
    });
  }

  async function openPanel() {
    setOpen(true);
    setNotice(null);
    setScheduleOpen(false);
    void fetch(`/api/admin/companies/${companyId}/reach-out`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => setZone(j?.zone ?? null))
      .catch(() => {});
    if (!body) await loadDraft();
  }

  const schedWhen = schedDate && schedTime ? new Date(`${schedDate}T${schedTime}`) : null;
  const schedValid = schedWhen !== null && !Number.isNaN(schedWhen.getTime());

  async function submitSchedule() {
    if (!schedValid || !schedWhen) {
      setNotice({ kind: "err", text: "Pick a date and time first." });
      return;
    }
    setScheduling(true);
    setNotice(null);
    try {
      const res = await fetch(`/api/admin/companies/${companyId}/reach-out`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "schedule", subject, body, appendSignature, alsoNudge, via, sendAt: schedWhen.toISOString() }),
      });
      const j = await res.json().catch(() => ({}));
      if (res.ok) {
        setNotice({ kind: "ok", text: "Email scheduled." });
        setScheduleOpen(false);
        // Refreshes the Scheduled emails card on the company page.
        window.dispatchEvent(new CustomEvent("reach-out-scheduled", { detail: { companyId } }));
      } else {
        setNotice({ kind: "err", text: j.error ?? "Could not schedule that email." });
      }
    } finally {
      setScheduling(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={openPanel}
        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
      >
        <i className="ti ti-mail" aria-hidden="true" /> Reach out to founder
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-xl">
            <div className="mb-3 flex items-start justify-between">
              <div>
                <h3 className="text-base font-semibold text-slate-900">Reach out to {founderName}</h3>
                <p className="mt-0.5 text-xs text-slate-500">
                  {stageLabel} ·{" "}
                  {situation === "cleared"
                    ? "nothing blocking"
                    : situation === "locked-far"
                      ? "locked upstream"
                      : situation === "locked-near"
                        ? "locked — near"
                        : `${pendingItems.length} blocking`}
                  {facts.length ? ` · drafted from ${facts.length} findings` : null}
                </p>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100" aria-label="Close">✕</button>
            </div>

            <label className="mb-1 block text-xs font-medium text-slate-600">To</label>
            <input value={founderEmail ?? ""} readOnly className="mb-3 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600" />

            <label className="mb-1 block text-xs font-medium text-slate-600">Subject</label>
            <input value={subject} onChange={(e) => setSubject(e.target.value)} className="mb-3 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none" />

            <label className="mb-1 block text-xs font-medium text-slate-600">Message {busy === "draft" ? <span className="text-slate-400">· drafting…</span> : null}</label>
            <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={8} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm leading-relaxed focus:border-indigo-400 focus:outline-none" />

            <div className="mt-2 flex flex-wrap gap-4">
              <label className="flex items-center gap-2 text-xs text-slate-600">
                <input type="checkbox" checked={appendSignature} onChange={(e) => setAppendSignature(e.target.checked)} /> Append my signature
              </label>
              <label className="flex items-center gap-2 text-xs text-slate-600">
                <input type="checkbox" checked={alsoNudge} onChange={(e) => setAlsoNudge(e.target.checked)} /> Also drop an in-app nudge
              </label>
            </div>

            {notice ? (
              <div className="mt-3 text-xs font-medium">
                <p className={notice.kind === "ok" ? "text-emerald-600" : "text-red-600"}>{notice.text}</p>
                {notice.kind === "err" && /connect/i.test(notice.text) ? (
                  <a
                    href={`/api/integrations/google/connect?returnTo=${encodeURIComponent(
                      typeof window !== "undefined" ? window.location.pathname + window.location.hash : "/admin",
                    )}`}
                    className="mt-1 inline-flex items-center gap-1 rounded-lg border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-indigo-700 hover:bg-indigo-100"
                  >
                    <i className="ti ti-brand-google" aria-hidden="true" /> Connect Google (with Gmail)
                  </a>
                ) : null}
              </div>
            ) : null}

            {!founderCanDistribute ? (
              <div className="mt-3 flex items-start gap-2.5 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2.5">
                <i className="ti ti-lock mt-0.5 text-sky-700" aria-hidden="true" />
                <div className="text-[11.5px] leading-relaxed text-sky-900">
                  <span className="font-semibold">Investor access is a separate step on a paid plan.</span> Becoming investor-ready doesn&apos;t grant it.
                  <label className="mt-1.5 flex cursor-pointer items-center gap-2 text-sky-800">
                    <input type="checkbox" checked={includeUpgrade} onChange={(e) => toggleUpgrade(e.target.checked)} /> Include an upgrade-to-access mention in the email
                  </label>
                </div>
              </div>
            ) : null}

            {/* Sender. iCapOS needs no Google connection and is the default. */}
            <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
              <span className="text-xs font-medium text-slate-600">Send with</span>
              {([
                { key: "icapos" as Via, icon: "ti-mail", label: "iCapOS", hint: "no Google needed" },
                { key: "gmail" as Via, icon: "ti-brand-google", label: "My Gmail", hint: "from you personally" },
              ]).map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => setVia(opt.key)}
                  aria-pressed={via === opt.key}
                  className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs ${
                    via === opt.key
                      ? "border-indigo-400 bg-indigo-50 font-semibold text-indigo-800"
                      : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  <i className={`ti ${opt.icon}`} aria-hidden="true" /> {opt.label}
                  <span className="font-normal text-slate-400">· {opt.hint}</span>
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-[11px] text-slate-400">
              {via === "icapos"
                ? "From the iCapOS address, reply-to you, logged on the company timeline."
                : "From your own Gmail address and saved in your Sent folder."}
            </p>

            {scheduleOpen ? (
              <div className="mt-3 rounded-lg border border-slate-200 bg-white p-2.5">
                <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">Schedule this email <span className="font-normal normal-case text-slate-400">· your local time</span></div>
                <div className="flex flex-wrap items-center gap-2">
                  <input type="date" value={schedDate} onChange={(e) => setSchedDate(e.target.value)} className="rounded border border-slate-300 px-2 py-1 text-[11.5px]" />
                  <input type="time" value={schedTime} onChange={(e) => setSchedTime(e.target.value)} className="rounded border border-slate-300 px-2 py-1 text-[11.5px]" />
                  <button
                    type="button"
                    disabled={scheduling || busy !== null || !subject || !body}
                    onClick={() => void submitSchedule()}
                    className="rounded-lg bg-[#5B2AD6] px-3 py-1.5 text-[11.5px] font-semibold text-white hover:opacity-90 disabled:opacity-50"
                  >
                    {scheduling ? "Scheduling…" : "Set schedule"}
                  </button>
                </div>
                {schedValid && schedWhen && zone ? (
                  <p className="mt-2 rounded-md bg-emerald-50 px-2 py-1.5 text-[11px] text-emerald-800">
                    Arrives <b>{arrivalLabel(schedWhen.toISOString(), zone)}</b> for {founderName.split(" ")[0]} ({zone.stateName})
                  </p>
                ) : null}
              </div>
            ) : null}

            <div className="mt-4 flex items-center gap-2">
              <button type="button" onClick={loadDraft} disabled={busy !== null} className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-medium text-indigo-700 hover:bg-indigo-100 disabled:opacity-60">
                <i className="ti ti-sparkles" aria-hidden="true" /> Redraft
              </button>
              <span className="ml-auto" />
              {/* Only Gmail has a Drafts folder to save into. */}
              {via === "gmail" ? (
                <button type="button" onClick={() => act("save-draft")} disabled={busy !== null || !subject || !body} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60">
                  {busy === "save" ? "Saving…" : "Save to Gmail drafts"}
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => setScheduleOpen((v) => !v)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs font-semibold text-sky-700 hover:bg-sky-100"
              >
                <i className="ti ti-calendar-plus" aria-hidden="true" /> Schedule
              </button>
              <button type="button" onClick={() => act("send")} disabled={busy !== null || !subject || !body} className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-60">
                {busy === "send" ? "Sending…" : via === "icapos" ? "Send with iCapOS" : "Send from my Gmail"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
