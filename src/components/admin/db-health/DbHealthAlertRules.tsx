"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { WorkspaceSection } from "@/components/admin/company-workspace/WorkspaceSection";
import { DEFAULT_HEALTH_SETTINGS, type HealthSettings } from "@/lib/db-health/evaluate";

const input = "w-24 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-right text-sm tabular-nums";

function Row({ label, field, hint }: Readonly<{ label: string; field: React.ReactNode; hint: React.ReactNode }>) {
  return (
    <div className="border-t border-slate-100 py-3 first:border-t-0">
      <div className="flex items-center justify-between gap-3 text-sm text-slate-800"><span>{label}</span><span className="flex items-center gap-1.5 whitespace-nowrap">{field}</span></div>
      <p className="mt-1.5 text-xs leading-relaxed text-slate-500">{hint}</p>
    </div>
  );
}

/** Alert limits with the default and the reason for it beside each one. Save and Reset sit in the card header. */
export function DbHealthAlertRules({ initial }: Readonly<{ initial: HealthSettings }>) {
  const router = useRouter();
  const d = DEFAULT_HEALTH_SETTINGS;
  const [warnS, setWarnS] = useState(String(initial.warnMs / 1000));
  const [overloadS, setOverloadS] = useState(String(initial.overloadMs / 1000));
  const [consecutive, setConsecutive] = useState(String(initial.consecutive));
  const [queryS, setQueryS] = useState(String(initial.queryLimitS));
  const [cron, setCron] = useState(initial.alertOnCronTimeouts);
  const [bell, setBell] = useState(initial.notifyBell);
  const [email, setEmail] = useState(initial.notifyEmail);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  function fill(s: HealthSettings) {
    setWarnS(String(s.warnMs / 1000));
    setOverloadS(String(s.overloadMs / 1000));
    setConsecutive(String(s.consecutive));
    setQueryS(String(s.queryLimitS));
    setCron(s.alertOnCronTimeouts);
    setBell(s.notifyBell);
    setEmail(s.notifyEmail);
  }

  async function send(body: unknown, done: string) {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/db-health/settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) setMsg({ ok: false, text: typeof j.error === "string" ? j.error : "Couldn't save. Try again." });
      else {
        if (j.settings) fill(j.settings as HealthSettings);
        setMsg({ ok: true, text: done });
        router.refresh();
      }
    } catch {
      setMsg({ ok: false, text: "Couldn't reach the server. Try again." });
    } finally {
      setBusy(false);
    }
  }

  const save = () =>
    send(
      {
        action: "save",
        settings: {
          warnMs: Math.round(Number(warnS) * 1000),
          overloadMs: Math.round(Number(overloadS) * 1000),
          consecutive: Math.round(Number(consecutive)),
          queryLimitS: Number(queryS),
          alertOnCronTimeouts: cron,
          notifyBell: bell,
          notifyEmail: email,
        },
      },
      "Alert rules saved.",
    );

  const check = (v: boolean, set: (b: boolean) => void, label: string) => (
    <input type="checkbox" checked={v} onChange={(e) => set(e.target.checked)} aria-label={label} className="h-4 w-4 accent-indigo-600" />
  );

  return (
    <WorkspaceSection
      icon="ti-bell-ringing"
      title="Alert rules"
      subtitle="Who is told, and when. Each rule shows its default and why."
      action={
        <span className="flex gap-2">
          <button type="button" disabled={busy} onClick={() => send({ action: "reset" }, "Back to the defaults.")} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 disabled:opacity-50">Reset to defaults</button>
          <button type="button" disabled={busy} onClick={save} className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">Save</button>
        </span>
      }
    >
      <div className="rounded-xl border border-slate-200 bg-white px-4">
        <div className="my-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs leading-relaxed text-emerald-900">
          Your database cancels signed in requests after 8 s and public requests after 3 s, and scheduled jobs stop at 60 s. The defaults warn you before those cutoffs.
        </div>
        {msg ? <p role="status" className={`mb-2 rounded-lg px-3 py-2 text-xs ${msg.ok ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800"}`}>{msg.text}</p> : null}
        <Row label="Warn when response time is above" field={<><input className={input} inputMode="decimal" value={warnS} onChange={(e) => setWarnS(e.target.value)} aria-label="Warning limit in seconds" /> s</>} hint={<>Default <b>{d.warnMs / 1000} s</b>, 25% of the 8 s cutoff. Must stay below the overload limit.</>} />
        <Row label="Overload alert when above" field={<><input className={input} inputMode="decimal" value={overloadS} onChange={(e) => setOverloadS(e.target.value)} aria-label="Overload limit in seconds" /> s</>} hint={<>Default <b>{d.overloadMs / 1000} s</b>, 62.5% of the 8 s cutoff. Must stay below 8 s, where signed in requests start failing.</>} />
        <Row label="For this many checks in a row" field={<input className={input} inputMode="numeric" value={consecutive} onChange={(e) => setConsecutive(e.target.value)} aria-label="Checks in a row" />} hint={<>Default <b>{d.consecutive}</b>. Checks run every 5 minutes, so an overload alert arrives within {Number(consecutive) > 0 ? Number(consecutive) * 5 : d.consecutive * 5} minutes and one blip does not trigger it.</>} />
        <Row label="Alert when any query runs longer than" field={<><input className={input} inputMode="decimal" value={queryS} onChange={(e) => setQueryS(e.target.value)} aria-label="Query limit in seconds" /> s</>} hint={<>Default <b>{d.queryLimitS} s</b>, 50% of the 60 s job limit. Must stay below 60 s.</>} />
        <Row label="Alert on cron timeouts" field={check(cron, setCron, "Alert on cron timeouts")} hint={<>Default <b>On</b>, alert on the first timeout.</>} />
        <Row label="Notify in the bell" field={check(bell, setBell, "Notify in the bell")} hint={<>Default <b>On</b>. Goes to every admin and analyst.</>} />
        <Row label="Notify by email" field={check(email, setEmail, "Notify by email")} hint={<>Default <b>On</b>. Goes to every admin and analyst.</>} />
      </div>
    </WorkspaceSection>
  );
}
