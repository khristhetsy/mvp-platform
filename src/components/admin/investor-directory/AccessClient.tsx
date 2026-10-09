"use client";

/**
 * Access by plan, founder access, upgrade requests, and the gatekeeping rules.
 * Prices are left blank until an admin sets them: founders then see a
 * "Request access" button instead of a price.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Section, Tag, fmtPT, postJson } from "@/components/admin/investor-directory/ui";
import type { DirectorySettings, DirectoryTier } from "@/lib/investor-directory/types";

export type AccessFounder = { founderId: string; name: string; company: string | null; tierKey: string; status: "active" | "paused" | "suspended"; held: number };
export type UpgradeRequest = { id: string; profileId: string; name: string; requestedTier: string; status: string; createdAt: string };

function Switch({ on, label, onChange }: Readonly<{ on: boolean; label: string; onChange: (v: boolean) => void }>) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)}
      className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${on ? "bg-[#1A6CE4]" : "bg-slate-300"}`}>
      <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${on ? "left-[18px]" : "left-0.5"}`} />
    </button>
  );
}

export function AccessClient({ tiers, settings, founders, requests }: Readonly<{
  tiers: DirectoryTier[]; settings: DirectorySettings; founders: AccessFounder[]; requests: UpgradeRequest[];
}>) {
  const router = useRouter();
  const [rules, setRules] = useState(settings);
  const [msg, setMsg] = useState<{ text: string; bad?: boolean } | null>(null);
  const say = (r: { ok: boolean; error?: string }, text: string) => setMsg(r.ok ? { text } : { text: r.error ?? "Couldn't save.", bad: true });

  async function saveTier(key: string, patch: Partial<DirectoryTier>) {
    const r = await postJson("/api/admin/investor-directory/access", "PATCH", { key, ...patch });
    say(r as { ok: boolean; error?: string }, "Plan saved.");
    if (r.ok) router.refresh();
  }
  async function saveRule(patch: Partial<DirectorySettings>) {
    setRules((s) => ({ ...s, ...patch }));
    const r = await postJson("/api/admin/investor-directory/settings", "PATCH", patch);
    say(r as { ok: boolean; error?: string }, "Rule saved.");
  }
  async function setAccess(founderId: string, patch: { tier?: string; status?: string; reason?: string; requestId?: string }) {
    const r = await postJson("/api/admin/investor-directory/access/founder", "PATCH", { founderId, ...patch });
    say(r as { ok: boolean; error?: string }, "Access updated.");
    if (r.ok) router.refresh();
  }

  const num = (k: keyof DirectorySettings, label: string, hint: string, min: number) => (
    <label className="flex items-center gap-2 border-t border-slate-100 px-4 py-2.5 text-[13px]">
      <span className="min-w-0 flex-1"><span className="text-slate-800">{label}</span><span className="block text-[11.5px] text-slate-500">{hint}</span></span>
      <input type="number" min={min} defaultValue={rules[k] as number}
        onBlur={(e) => { const v = Math.max(min, Math.round(Number(e.target.value) || min)); if (v !== rules[k]) void saveRule({ [k]: v } as Partial<DirectorySettings>); }}
        className="h-8 w-24 rounded-md border border-slate-300 px-2 text-right text-[13px]" />
    </label>
  );
  const toggle = (k: keyof DirectorySettings, label: string, hint: string) => (
    <div className="flex items-center gap-2 border-t border-slate-100 px-4 py-2.5 text-[13px]">
      <span className="min-w-0 flex-1"><span className="text-slate-800">{label}</span><span className="block text-[11.5px] text-slate-500">{hint}</span></span>
      <Switch on={rules[k] as boolean} label={label} onChange={(v) => void saveRule({ [k]: v } as Partial<DirectorySettings>)} />
    </div>
  );

  return (
    <div className="space-y-4">
      {msg ? <p className={`rounded-md px-3 py-2 text-[12.5px] ${msg.bad ? "bg-[#FCEBEB] text-[#791F1F]" : "bg-[#EAF3DE] text-[#27500A]"}`}>{msg.text}</p> : null}

      <Section title="Access by plan" icon="ti-key">
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-slate-100 text-left text-[11px] text-slate-500">
                <th className="px-4 py-2">Plan</th><th className="px-2 py-2 text-right">Hold limit</th><th className="px-2 py-2 text-right">Monthly price</th>
                <th className="px-2 py-2 text-center">Email and phone</th><th className="px-2 py-2 text-center">Export</th>
              </tr>
            </thead>
            <tbody>
              {tiers.map((t) => (
                <tr key={t.key} className="border-b border-slate-50">
                  <td className="px-4 py-2 font-medium text-slate-800">{t.label}</td>
                  <td className="px-2 py-2 text-right">
                    {t.key === "free" ? "0" : (
                      <input type="number" min={0} defaultValue={t.hold_limit} aria-label={`${t.label} hold limit`}
                        onBlur={(e) => { const v = Math.max(0, Math.round(Number(e.target.value) || 0)); if (v !== t.hold_limit) void saveTier(t.key, { hold_limit: v }); }}
                        className="h-8 w-24 rounded-md border border-slate-300 px-2 text-right" />
                    )}
                  </td>
                  <td className="px-2 py-2 text-right">
                    {t.key === "free" ? "Free" : (
                      <input type="number" min={0} step="1" placeholder="Not set" defaultValue={t.price_cents === null ? "" : t.price_cents / 100} aria-label={`${t.label} monthly price in dollars`}
                        onBlur={(e) => { const raw = e.target.value.trim(); const cents = raw === "" ? null : Math.round(Number(raw) * 100); if (cents !== t.price_cents) void saveTier(t.key, { price_cents: cents }); }}
                        className="h-8 w-24 rounded-md border border-slate-300 px-2 text-right" />
                    )}
                  </td>
                  <td className="px-2 py-2 text-center"><span className="inline-flex"><Switch on={t.show_email} label={`${t.label} email and phone`} onChange={(v) => void saveTier(t.key, { show_email: v })} /></span></td>
                  <td className="px-2 py-2 text-center"><span className="inline-flex"><Switch on={t.can_export} label={`${t.label} export`} onChange={(v) => void saveTier(t.key, { can_export: v })} /></span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="px-4 py-2.5 text-[12px] text-slate-500">Email and phone show only after import. Founders never see iCFO network investors here. A blank price means founders request access and you assign the plan below.</p>
      </Section>

      <Section title="Upgrade requests" icon="ti-arrow-up-circle">
        {requests.length === 0 ? <p className="px-4 py-6 text-center text-sm text-slate-500">No requests.</p> : requests.map((r) => (
          <div key={r.id} className="flex flex-wrap items-center gap-2 border-t border-slate-100 px-4 py-2.5 text-[13px] first:border-t-0">
            <span className="min-w-0 flex-1"><span className="text-slate-800">{r.name}</span><span className="block text-[11.5px] text-slate-500">Asked for {tiers.find((t) => t.key === r.requestedTier)?.label ?? r.requestedTier} · {fmtPT(r.createdAt, true)}</span></span>
            {r.status === "pending" ? (
              <button type="button" onClick={() => void setAccess(r.profileId, { tier: r.requestedTier, requestId: r.id })} className="rounded-lg bg-[#1A6CE4] px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-[#2E78F5]">Grant plan</button>
            ) : <Tag tone="ok">{r.status === "approved" ? "Granted" : r.status}</Tag>}
          </div>
        ))}
      </Section>

      <Section title="Founder access" icon="ti-users">
        {founders.length === 0 ? <p className="px-4 py-6 text-center text-sm text-slate-500">No founder has used the directory yet.</p> : founders.map((f) => (
          <div key={f.founderId} className="flex flex-wrap items-center gap-2 border-t border-slate-100 px-4 py-2.5 text-[13px] first:border-t-0">
            <span className="min-w-0 flex-1">
              <Link href={`/admin/investor-directory/usage/${f.founderId}`} className="text-slate-800 hover:text-[#1A6CE4]">{f.name}</Link>
              <span className="block text-[11.5px] text-slate-500">{f.company ?? "No company"} · {f.held.toLocaleString("en-US")} held</span>
            </span>
            <select aria-label={`Plan for ${f.name}`} value={f.tierKey} onChange={(e) => void setAccess(f.founderId, { tier: e.target.value })} className="h-8 rounded-md border border-slate-300 px-2 text-[12.5px]">
              {tiers.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
            </select>
            {f.status !== "active" ? <Tag tone={f.status === "paused" ? "warn" : "bad"}>{f.status === "paused" ? "Paused" : "Suspended"}</Tag> : null}
          </div>
        ))}
      </Section>

      <Section title="Gatekeeping rules" icon="ti-lock">
        {toggle("block_over_limit", "Block imports over the plan limit", "Founders see an upgrade prompt instead")}
        {num("daily_cap", "Daily import cap per founder", "Contacts per Pacific day", 1)}
        {num("spike_imports", "Flag usage spikes above", `Imports within ${rules.spike_hours} hours`, 1)}
        {num("spike_hours", "Spike window (hours)", "How far back the spike check looks", 1)}
        {toggle("auto_pause_on_bounce", "Auto pause on high bounce rate", `Above ${rules.bounce_pause_pct}% once ${rules.bounce_min_sends} emails are sent`)}
        {num("bounce_pause_pct", "Bounce rate to pause (%)", "Checked before each import", 1)}
        {num("bounce_min_sends", "Minimum sends before judging bounces", "Avoids pausing on a handful of emails", 1)}
        {toggle("require_terms", "Require terms acceptance", "Before a founder's first import")}
        {toggle("honor_opt_outs", "Honor opt-outs everywhere", "An opt-out removes the investor from every founder's list")}
        {toggle("allow_export", "Allow export", "Only plans with Export on can download their held contacts")}
        {num("stale_days", "Re-verify after (days)", "Verified records older than this return to the queue", 7)}
      </Section>
    </div>
  );
}
