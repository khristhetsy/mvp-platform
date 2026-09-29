"use client";

import { useState } from "react";
import { MetricCard } from "@/components/MetricCard";
import { WorkspaceSection } from "@/components/admin/company-workspace/WorkspaceSection";
import type { BudgetConfig, JobTier } from "@/lib/notifications/founder-email-budget/config";
import type { BudgetMetrics } from "@/lib/notifications/founder-email-budget/metrics";

type JobRow = { path: string; name: string; tier: JobTier; note: string; schedule: string };

const TIER_STYLE: Record<JobTier, { label: string; className: string }> = {
  instant: { label: "Instant", className: "bg-red-50 text-red-700" },
  digest: { label: "Daily digest", className: "bg-blue-50 text-[#1A6CE4]" },
  weekly: { label: "Weekly", className: "bg-emerald-50 text-emerald-800" },
  none: { label: "Not founder facing", className: "bg-slate-100 text-slate-600" },
};

type RuleKey = keyof BudgetConfig["rules"];

const RULES: Array<{ key: RuleKey; group: string; name: string; desc: string }> = [
  { key: "batchIntoDigest", group: "Volume", name: "Batch into one digest", desc: "Nudges, match notices, summaries and follow ups are held for one scheduled email instead of sent on their own." },
  { key: "suppressEmpty", group: "Volume", name: "Never send empty emails", desc: "A founder with nothing held gets no digest." },
  { key: "localTime", group: "Timing", name: "Send in founder local time", desc: "The digest goes out at the founder's hour in their own time zone. Off: the hour is read in UTC." },
  { key: "quietHours", group: "Timing", name: "Quiet hours", desc: "No digest goes out inside the quiet window, even if a founder picked an hour there." },
  { key: "skipIfActive", group: "Relevance", name: "Skip if recently active", desc: "If the founder has been in the app since their newest held update, today's digest waits." },
  { key: "repeatLimit", group: "Relevance", name: "Repeat limit", desc: "The same reminder stops being held after the limit within 30 days." },
  { key: "autoDownshift", group: "Relevance", name: "Auto downshift", desc: "Founders who stop opening digests move from daily to weekly, then to instant alerts only." },
  { key: "complaintGuard", group: "Safety", name: "Complaint rate guard", desc: "Pauses founder digests when spam complaints reach the pause rate (Gmail and Yahoo require under 0.3%)." },
  { key: "oneClickUnsubscribe", group: "Safety", name: "One click unsubscribe", desc: "List-Unsubscribe header on every digest; one click moves the founder to instant alerts only." },
];

function fmt(n: number | null, digits = 1): string {
  return n === null ? "Not measured" : n.toFixed(digits).replace(/\.0+$/, "");
}

function NumberField({ id, label, value, min, max, step = 1, suffix, onChange }: {
  id: string; label: string; value: number; min: number; max: number; step?: number; suffix?: string; onChange: (v: number) => void;
}) {
  return (
    <label htmlFor={id} className="flex flex-col gap-1.5 text-xs font-semibold text-slate-700">
      {label}
      <span className="flex items-center gap-2">
        <input
          id={id}
          type="number"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="h-10 w-24 rounded-lg border border-slate-300 bg-white px-3 text-sm font-normal text-slate-900"
        />
        {suffix ? <span className="text-xs font-normal text-slate-500">{suffix}</span> : null}
      </span>
    </label>
  );
}

function TimeField({ id, label, value, onChange }: { id: string; label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label htmlFor={id} className="flex flex-col gap-1.5 text-xs font-semibold text-slate-700">
      {label}
      <input id={id} type="time" value={value} onChange={(e) => onChange(e.target.value)} className="h-10 w-32 rounded-lg border border-slate-300 bg-white px-3 text-sm font-normal text-slate-900" />
    </label>
  );
}

export function FounderEmailBudgetClient({ initial, metrics, jobs }: Readonly<{ initial: BudgetConfig; metrics: BudgetMetrics; jobs: JobRow[] }>) {
  const [cfg, setCfg] = useState<BudgetConfig>(initial);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const dirty = JSON.stringify(cfg) !== JSON.stringify(initial);

  const set = <K extends keyof BudgetConfig>(key: K, value: BudgetConfig[K]) => {
    setCfg((c) => ({ ...c, [key]: value }));
    setMessage(null);
  };
  const setRule = (key: RuleKey, value: boolean) => {
    setCfg((c) => ({ ...c, rules: { ...c.rules, [key]: value } }));
    setMessage(null);
  };

  async function save() {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/founder-email-budget", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config: cfg }),
      });
      const json = (await res.json().catch(() => null)) as { config?: BudgetConfig; error?: string } | null;
      if (!res.ok || !json?.config) throw new Error(json?.error ?? "Couldn't save. Try again.");
      setCfg(json.config);
      setMessage({ tone: "ok", text: "Saved. New rules apply from the next run." });
      window.location.reload();
    } catch (err) {
      setMessage({ tone: "error", text: err instanceof Error ? err.message : "Couldn't save. Try again." });
    } finally {
      setSaving(false);
    }
  }

  const live = initial.rolloutPct > 0;
  const r = metrics.rollout;
  const h = metrics.holdout;
  const measured = live && r.founders > 0 && h.founders > 0;
  const loaded = `Email log and profiles, loaded ${new Date(metrics.loadedAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}`;
  const notLive = "Measured once the rollout is above 0% and both groups have founders.";

  let emailsFlag: { text: string; tone: "good" | "warn" | "bad" } | null = null;
  if (measured && r.emailsPerFounder !== null && h.emailsPerFounder !== null && h.emailsPerFounder > 0) {
    const diff = ((r.emailsPerFounder - h.emailsPerFounder) / h.emailsPerFounder) * 100;
    emailsFlag = { text: `${Math.abs(diff).toFixed(0)}% ${diff <= 0 ? "fewer" : "more"} than holdout`, tone: diff <= 0 ? "good" : "warn" };
  }
  const c = metrics.complaints;

  return (
    <div className="space-y-8">
      <p className="text-sm text-slate-600">
        The jobs keep running on their schedules. These rules decide what reaches a founder&apos;s inbox. Rollout founders get the rules,
        holdout founders keep today&apos;s behavior so the two can be compared, and everyone else is unchanged.
        {live ? null : <strong className="font-semibold text-slate-900"> The rollout is at 0%, so nothing has changed for any founder yet.</strong>}
      </p>

      <WorkspaceSection icon="ti-chart-bar" title="Input metrics" subtitle="Last 7 days, rollout against holdout. Complaints over 30 days, all founders.">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <MetricCard
            label="Emails per founder"
            value={measured ? fmt(r.emailsPerFounder) : "Not measured"}
            unit={measured ? `vs ${fmt(h.emailsPerFounder)} holdout` : undefined}
            detail={measured ? `${r.emails7d} emails to ${r.founders} rollout founders` : notLive}
            ring={{ percent: null, pending: true }}
            flag={emailsFlag}
            lastUpdated={loaded}
            audience="admin"
          />
          <MetricCard
            label="Emails that led to a click"
            value={measured && r.actionRate !== null ? `${fmt(r.actionRate)}%` : "Not measured"}
            unit={measured && h.actionRate !== null ? `vs ${fmt(h.actionRate)}% holdout` : undefined}
            detail={measured ? "Clicks recorded by Resend on founder emails" : notLive}
            ring={measured && r.actionRate !== null ? { percent: Math.min(100, r.actionRate) } : { percent: null, pending: true }}
            lastUpdated={loaded}
            audience="admin"
          />
          <MetricCard
            label="Digest unsubscribes"
            value={measured ? String(r.unsubscribes7d) : "Not measured"}
            unit={measured ? `vs ${h.unsubscribes7d} holdout` : undefined}
            detail={measured ? "One click moves to instant alerts only" : notLive}
            ring={{ percent: null, pending: true }}
            lastUpdated={loaded}
            audience="admin"
          />
          <MetricCard
            label="Spam complaint rate"
            value={c.sent > 0 ? `${c.rate.toFixed(2)}%` : "Not measured"}
            unit={`pause at ${cfg.complaintPausePct}%`}
            detail={c.sent > 0 ? `${c.complaints} complaints on ${c.sent} founder emails, 30 days` : "No founder emails in the email log for 30 days"}
            ring={{ percent: null, pending: true }}
            flag={c.sent > 0 ? (c.level === "pause" ? { text: "Digests paused", tone: "bad" } : c.level === "alert" ? { text: `At or above ${cfg.complaintAlertPct}% alert`, tone: "warn" } : { text: "Under the alert rate", tone: "good" }) : null}
            lastUpdated={loaded}
            audience="admin"
          />
          <MetricCard
            label="Founders at Match or later"
            value={measured ? `${fmt(r.atMatchOrLater)}%` : "Not measured"}
            unit={measured ? `vs ${fmt(h.atMatchOrLater)}% holdout` : undefined}
            detail={measured ? `${r.founders} rollout, ${h.founders} holdout founders · ${metrics.heldPending} updates held · ${metrics.digestsSent7d} digests sent` : notLive}
            ring={measured && r.atMatchOrLater !== null ? { percent: r.atMatchOrLater } : { percent: null, pending: true }}
            lastUpdated={loaded}
            audience="admin"
          />
        </div>
      </WorkspaceSection>

      <WorkspaceSection
        icon="ti-adjustments"
        title="Delivery rules"
        subtitle="Saved rules apply from the next run of each job."
        action={
          <span className="flex items-center gap-3">
            {message ? <span className={`text-xs ${message.tone === "ok" ? "text-emerald-700" : "text-red-700"}`}>{message.text}</span> : null}
            <button
              type="button"
              onClick={() => { setCfg(initial); setMessage(null); }}
              disabled={!dirty || saving}
              className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700 disabled:opacity-40"
            >
              Reset
            </button>
            <button
              type="button"
              onClick={save}
              disabled={!dirty || saving}
              className="h-9 rounded-lg bg-[#1A6CE4] px-4 text-sm font-semibold text-white hover:bg-[#2E78F5] disabled:opacity-40"
            >
              {saving ? "Saving…" : "Save rules"}
            </button>
          </span>
        }
      >
        <div className="grid grid-cols-2 gap-5 rounded-xl border border-slate-200 bg-white p-5 md:grid-cols-4 xl:grid-cols-6">
          <NumberField id="feb-rollout" label="Rollout" value={cfg.rolloutPct} min={0} max={100 - cfg.holdoutPct} suffix="% of founders" onChange={(v) => set("rolloutPct", v)} />
          <NumberField id="feb-holdout" label="Holdout" value={cfg.holdoutPct} min={0} max={50} suffix="% of founders" onChange={(v) => set("holdoutPct", v)} />
          <NumberField id="feb-cap" label="Digests per day" value={cfg.dailyCap} min={1} max={3} suffix="max" onChange={(v) => set("dailyCap", v)} />
          <NumberField id="feb-hour" label="Default send hour" value={cfg.sendHour} min={0} max={23} suffix=":00 local" onChange={(v) => set("sendHour", v)} />
          <TimeField id="feb-qs" label="Quiet from" value={cfg.quietStart} onChange={(v) => set("quietStart", v)} />
          <TimeField id="feb-qe" label="Quiet until" value={cfg.quietEnd} onChange={(v) => set("quietEnd", v)} />
          <NumberField id="feb-active" label="Skip if active within" value={cfg.skipActiveHours} min={0} max={168} suffix="hours" onChange={(v) => set("skipActiveHours", v)} />
          <NumberField id="feb-repeat" label="Repeat limit" value={cfg.maxRemindersPerItem} min={1} max={20} suffix="per reminder" onChange={(v) => set("maxRemindersPerItem", v)} />
          <NumberField id="feb-down" label="Downshift after" value={cfg.downshiftAfter} min={0} max={20} suffix="unopened" onChange={(v) => set("downshiftAfter", v)} />
          <NumberField id="feb-alert" label="Complaint alert" value={cfg.complaintAlertPct} min={0.01} max={5} step={0.01} suffix="%" onChange={(v) => set("complaintAlertPct", v)} />
          <NumberField id="feb-pause" label="Complaint pause" value={cfg.complaintPausePct} min={0.01} max={5} step={0.01} suffix="%" onChange={(v) => set("complaintPausePct", v)} />
          <NumberField id="feb-age" label="Held updates expire" value={cfg.itemMaxAgeDays} min={1} max={30} suffix="days" onChange={(v) => set("itemMaxAgeDays", v)} />
        </div>

        <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white">
          {RULES.map((rule) => (
            <div key={rule.key} className="grid grid-cols-[96px_1fr_auto] items-center gap-4 border-b border-slate-100 px-5 py-3 last:border-b-0">
              <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{rule.group}</span>
              <div>
                <p className="text-sm font-semibold text-slate-900">{rule.name}</p>
                <p className="text-xs leading-5 text-slate-500">{rule.desc}</p>
              </div>
              <label className="flex items-center gap-2 text-xs text-slate-600">
                <input
                  type="checkbox"
                  checked={cfg.rules[rule.key]}
                  onChange={(e) => setRule(rule.key, e.target.checked)}
                  className="h-4 w-4 accent-[#1A6CE4]"
                  aria-label={rule.name}
                />
                {cfg.rules[rule.key] ? "On" : "Off"}
              </label>
            </div>
          ))}
        </div>
      </WorkspaceSection>

      <WorkspaceSection icon="ti-route" title="Where each founder job delivers" subtitle="For rollout founders. Holdout and other founders get every email as before.">
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-slate-50 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-5 py-2.5">Job</th>
                <th className="px-5 py-2.5">Runs</th>
                <th className="px-5 py-2.5">Founder delivery</th>
                <th className="px-5 py-2.5">Note</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((j) => (
                <tr key={j.path} className="border-t border-slate-100">
                  <td className="px-5 py-3">
                    <p className="font-semibold text-slate-900">{j.name}</p>
                    <p className="font-mono text-xs text-slate-500">{j.path}</p>
                  </td>
                  <td className="px-5 py-3 text-slate-700">{j.schedule}</td>
                  <td className="px-5 py-3">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${TIER_STYLE[j.tier].className}`}>{TIER_STYLE[j.tier].label}</span>
                  </td>
                  <td className="px-5 py-3 text-slate-600">{j.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </WorkspaceSection>
    </div>
  );
}
