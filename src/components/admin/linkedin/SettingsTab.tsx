"use client";

import { useState } from "react";
import type { HubLinkedIn, LinkedInAccount } from "@/lib/linkedin/store";
import { LEVELS, dailyAutoCap, dailyTotalCap, levelSpec, warmUpDay, weeklyAutoCap, type AccountSafety } from "@/lib/linkedin/safety";
import { SenderCard } from "./SenderCard";
import { Choice, ErrorLine, Field, Section, Tag, Toggle, api, btnCls, inputCls, primaryCls } from "./ui";

type Patch = Partial<Pick<LinkedInAccount, "safety_level" | "custom_daily_cap" | "custom_weekly_cap" | "manual_allowance" | "high_value_tag" | "send_on_schedule" | "handoff_enabled" | "withdraw_pending" | "weekly_summary">>;

const ALWAYS_ON: Array<[string, string]> = [
  ["Stop on any captcha or limit warning", "Alerts you and restarts only when you approve."],
  ["Weekdays, owner's working hours", "Random gaps between invites."],
  ["Approved wording only", "Versions are picked at random. Unapproved text never sends."],
  ["Already connected", "A message is sent instead of an invite."],
  ["Has an email", "The email sequence goes first."],
  ["Acceptance below 20% after 50 invites", "The campaign pauses for your review."],
  ["Manual LinkedIn activity", "A daily allowance is set aside from the limit."],
];

export function SettingsTab({ account, sentToday, hub, onChanged }: Readonly<{ account: LinkedInAccount; sentToday: number; hub: HubLinkedIn | null; onChanged: (a: LinkedInAccount) => void }>) {
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const [daily, setDaily] = useState(String(account.custom_daily_cap ?? LEVELS.standard.daily));
  const [weekly, setWeekly] = useState(String(account.custom_weekly_cap ?? LEVELS.standard.weekly));
  const [allowance, setAllowance] = useState(String(account.manual_allowance));
  const [vipTag, setVipTag] = useState(account.high_value_tag ?? "");

  async function save(patch: Patch) {
    setSaving(true); setError(null);
    const r = await api<{ account: LinkedInAccount }>("/api/admin/linkedin/account", "PUT", patch);
    setSaving(false);
    if (r.ok) onChanged(r.data.account); else setError(r.error);
  }

  const safety: AccountSafety = { level: account.safety_level, customDaily: account.custom_daily_cap, customWeekly: account.custom_weekly_cap, manualAllowance: account.manual_allowance, warmUpStartedAt: account.warm_up_started_at };
  const now = new Date();
  const spec = levelSpec(safety);
  const day = warmUpDay(account.warm_up_started_at, now);
  const summary = account.safety_level === "careful"
    ? `up to ${LEVELS.careful.daily} invites a day`
    : account.safety_level === "custom" ? `up to ${spec.daily} invites a day` : `up to ${LEVELS.standard.daily} invites a day`;

  return (
    <div className="space-y-4">
      <Section title="Your LinkedIn account" icon="ti-brand-linkedin">
        <div className="flex flex-wrap items-center gap-3 px-4 py-3 text-[13px]">
          <span className="font-medium text-slate-900">{account.label}</span>
          <span className="text-slate-500">(messages are sent in this name)</span>
          <Tag tone={account.status === "connected" ? "ok" : account.status === "not_connected" ? "mute" : "warn"}>
            {account.status === "connected" ? "Connected" : account.status === "not_connected" ? "Not connected yet" : account.status === "paused" ? "Paused" : "LinkedIn warning"}
          </Tag>
        </div>
        <p className="px-4 pb-3 text-[12.5px] text-slate-500">Keep two factor sign in on. If LinkedIn shows a warning, sending pauses automatically and you are told. Connect it with the Sender below.</p>
      </Section>

      <SenderCard account={account} sentToday={sentToday} hub={hub} onChanged={onChanged} />

      <Section title="Autopilot" icon="ti-settings-automation">
        <ul className="divide-y divide-slate-100">
          {([
            ["send_on_schedule", "Send invites and follow ups on schedule", "Sends each campaign step on your delays, within your limits."],
            ["handoff_enabled", "Hand off to the AI assistant when someone accepts", "Johnny for investors, Jessica for founders, in our web chat with booking."],
            ["withdraw_pending", "Withdraw invites still pending after 3 weeks", "Keeps your pending list clean."],
            ["weekly_summary", "Weekly summary email", "Invites, acceptances, replies, meetings booked, any pauses."],
          ] as const).map(([key, label, hint]) => (
            <li key={key} className="flex items-center justify-between gap-3 px-4 py-3">
              <span><span className="block text-[13px] font-medium text-slate-900">{label}</span><span className="block text-[12px] text-slate-500">{hint}</span></span>
              <Toggle on={account[key]} label={label} disabled={saving} onChange={(v) => save({ [key]: v })} />
            </li>
          ))}
        </ul>
        <p className="border-t border-slate-100 px-4 py-2.5 text-[12px] text-slate-500">Always on: pause on any LinkedIn warning, random gaps during the owner&apos;s working hours. See Invite safety.</p>
      </Section>

      <Section title="Invite safety" icon="ti-shield-check">
        <div className="space-y-3 px-4 py-3">
          <p className="text-[12.5px] text-slate-500">Invites are the riskiest LinkedIn action. Pick one level, we handle the rest.</p>
          <div role="radiogroup" aria-label="Safety level" className="space-y-2">
            <Choice selected={account.safety_level === "careful"} onSelect={() => save({ safety_level: "careful" })} title="Careful">{LEVELS.careful.daily} invites a day, {LEVELS.careful.weekly} a week, slowest start. For a new or thin account.</Choice>
            <Choice selected={account.safety_level === "standard"} onSelect={() => save({ safety_level: "standard" })} title="Standard" badge={<span className="rounded-md bg-blue-50 px-1.5 py-0.5 text-[11px] font-medium text-blue-700">Recommended</span>}>{LEVELS.standard.daily} invites a day, {LEVELS.standard.weekly} a week, 3 week start. Used for the pilot.</Choice>
          </div>
          <p className="text-[13px] text-slate-700"><b>In plain words:</b> {summary}, weekdays only, paused automatically if people don&apos;t accept.</p>
          <p className="text-[12px] text-slate-500">
            Always on, not changeable: {ALWAYS_ON.slice(0, 5).map(([t]) => t.toLowerCase()).join(", ")}.{" "}
            <button type="button" className="text-[#1A6CE4] underline" onClick={() => setShowRules((v) => !v)}>{showRules ? "Hide details" : "See details"}</button>
          </p>
          {showRules ? (
            <ul className="space-y-1 rounded-lg bg-slate-50 px-3 py-2 text-[12.5px] text-slate-600">
              {ALWAYS_ON.map(([t, d]) => <li key={t}><b className="text-slate-800">{t}.</b> {d}</li>)}
            </ul>
          ) : null}
          <details className="text-[13px]">
            <summary className="cursor-pointer text-[#1A6CE4]">Custom limits and high value contacts</summary>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <Field label="Daily invite limit" hint={`1 to ${LEVELS.standard.daily}`}><input className={inputCls} inputMode="numeric" value={daily} onChange={(e) => setDaily(e.target.value)} /></Field>
              <Field label="Weekly invite limit" hint={`1 to ${LEVELS.standard.weekly}`}><input className={inputCls} inputMode="numeric" value={weekly} onChange={(e) => setWeekly(e.target.value)} /></Field>
              <Field label="Kept for invites you send by hand, per day"><input className={inputCls} inputMode="numeric" value={allowance} onChange={(e) => setAllowance(e.target.value)} /></Field>
              <Field label="High value tag" hint="Contacts with this tag become tasks for you to send by hand."><input className={inputCls} value={vipTag} onChange={(e) => setVipTag(e.target.value)} /></Field>
            </div>
            <div className="mt-3 flex gap-2">
              <button type="button" className={primaryCls} disabled={saving} onClick={() => save({
                safety_level: "custom", custom_daily_cap: clampInt(daily, 1, LEVELS.standard.daily), custom_weekly_cap: clampInt(weekly, 1, LEVELS.standard.weekly),
                manual_allowance: clampInt(allowance, 0, 20), high_value_tag: vipTag.trim() || null,
              })}>Save custom limits</button>
              <button type="button" className={btnCls} disabled={saving} onClick={() => save({ manual_allowance: clampInt(allowance, 0, 20), high_value_tag: vipTag.trim() || null })}>Save allowance and tag only</button>
            </div>
          </details>
          <ErrorLine text={error} />
        </div>
      </Section>

      <details className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-[13px]">
        <summary className="cursor-pointer text-[#1A6CE4]">Advanced settings</summary>
        <table className="mt-3 w-full text-left text-[13px]">
          <thead className="text-slate-500"><tr><th className="py-1 font-medium">Invites today (automatic)</th><th className="py-1 font-medium">Per week (automatic)</th><th className="py-1 font-medium">Warm up</th><th className="py-1 font-medium">Where it runs</th></tr></thead>
          <tbody><tr>
            <td className="py-1">{day ? `${dailyAutoCap(safety, now)} of ${dailyTotalCap(safety, now)} total` : "0"}</td>
            <td className="py-1">{day ? weeklyAutoCap(safety, now) : 0}</td>
            <td className="py-1">{day ? `Day ${Math.min(day, 21)} of 21` : "Starts when the sender connects"}</td>
            <td className="py-1">Owner&apos;s own machine and IP</td>
          </tr></tbody>
        </table>
        <p className="mt-2 text-[12px] text-slate-500">Sequence editor, per step delays and test results live here once the sender is connected.</p>
      </details>
    </div>
  );
}

function clampInt(v: string, lo: number, hi: number): number {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : lo;
}
