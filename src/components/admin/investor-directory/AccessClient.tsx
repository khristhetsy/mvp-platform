"use client";

/**
 * What each plan includes, founder access and the gatekeeping rules. Each plan
 * holds up to a set number of investors from every source. Top ups are retired:
 * a founder who needs more moves to a bigger plan.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Section, Tag, postJson } from "@/components/admin/investor-directory/ui";
import { NOT_NETWORK_NOTE, type DirectoryPlanAllowance, type DirectorySettings, type DirectoryTier } from "@/lib/investor-directory/types";

export type AccessFounder = {
  founderId: string; name: string; company: string | null; tierKey: string; status: "active" | "paused" | "suspended"; held: number;
  plan: string; contactLimit: number; emailsUsed: number; emailCap: number;
};
export type AllowanceRow = DirectoryPlanAllowance & { priceCents: number };

const n = (v: number) => v.toLocaleString("en-US");

/** The line a plan card shows for this allowance. */
function planCardLine(a: AllowanceRow): string {
  if (a.contacts <= 0) return "No directory access";
  const growing = a.contacts > 1000 ? "Up to " : "";
  const grows = a.contacts > 1000 ? " as the directory grows" : "";
  return `${growing}${n(a.contacts)} public directory investors${grows} (not the iCFO Capital investor network) · ${n(a.emails_per_month)} emails a month`;
}
export type UpgradeRequest = { id: string; profileId: string; name: string; requestedTier: string; status: string; createdAt: string };

function Switch({ on, label, onChange }: Readonly<{ on: boolean; label: string; onChange: (v: boolean) => void }>) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)}
      className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${on ? "bg-[#1A6CE4]" : "bg-slate-300"}`}>
      <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${on ? "left-[18px]" : "left-0.5"}`} />
    </button>
  );
}

export function AccessClient({ allowances, settings, founders }: Readonly<{
  tiers: DirectoryTier[]; allowances: AllowanceRow[]; settings: DirectorySettings; founders: AccessFounder[]; requests: UpgradeRequest[];
}>) {
  const router = useRouter();
  const [rules, setRules] = useState(settings);
  const [msg, setMsg] = useState<{ text: string; bad?: boolean } | null>(null);
  const say = (r: { ok: boolean; error?: string }, text: string) => setMsg(r.ok ? { text } : { text: r.error ?? "Couldn't save.", bad: true });

  async function saveAllowance(planType: string, patch: { contacts?: number; emails_per_month?: number }) {
    const r = await postJson("/api/admin/investor-directory/allowances", "PATCH", { plan_type: planType, ...patch });
    say(r as { ok: boolean; error?: string }, "Plan allowance saved.");
    if (r.ok) router.refresh();
  }
  const whole = (v: string) => Math.max(0, Math.round(Number(v) || 0));
  async function saveRule(patch: Partial<DirectorySettings>) {
    setRules((s) => ({ ...s, ...patch }));
    const r = await postJson("/api/admin/investor-directory/settings", "PATCH", patch);
    say(r as { ok: boolean; error?: string }, "Rule saved.");
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

      <Section title="Included with each plan" icon="ti-key">
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-slate-100 text-left text-[11px] text-slate-500">
                <th className="px-4 py-2">Plan</th><th className="px-2 py-2">Price</th>
                <th className="px-2 py-2 text-right">Directory contacts</th><th className="px-2 py-2 text-right">Manual outreach emails / 30 days</th>
                <th className="hidden px-4 py-2 lg:table-cell">Plan cards say</th>
              </tr>
            </thead>
            <tbody>
              {allowances.map((a) => (
                <tr key={a.plan_type} className="border-b border-slate-50">
                  <td className="px-4 py-2 font-medium text-slate-800">{a.label}</td>
                  <td className="px-2 py-2 text-slate-600">{a.priceCents > 0 ? `$${n(a.priceCents / 100)}` : "$0"}</td>
                  <td className="px-2 py-2 text-right">
                    <input type="number" min={0} defaultValue={a.contacts} aria-label={`${a.label} directory contacts`}
                      onBlur={(e) => { const v = whole(e.target.value); if (v !== a.contacts) void saveAllowance(a.plan_type, { contacts: v }); }}
                      className="h-8 w-24 rounded-md border border-slate-300 px-2 text-right" />
                  </td>
                  <td className="px-2 py-2 text-right">
                    <input type="number" min={0} defaultValue={a.emails_per_month} aria-label={`${a.label} emails per 30 days`}
                      onBlur={(e) => { const v = whole(e.target.value); if (v !== a.emails_per_month) void saveAllowance(a.plan_type, { emails_per_month: v }); }}
                      className="h-8 w-24 rounded-md border border-slate-300 px-2 text-right" />
                  </td>
                  <td className="hidden px-4 py-2 text-[12px] text-slate-500 lg:table-cell">{planCardLine(a)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="px-4 py-2.5 text-[12px] text-slate-500">
          Each plan holds up to this many investors from every source: directory, Form D, LinkedIn, CSV or Excel and added by hand (iCFO introductions don&apos;t count). Emails count every Manual outreach email and reset every 30 days from signup, the same window as the plan&apos;s investor limit. None of these count toward the 5 or 50 matched investor limit. {NOT_NETWORK_NOTE}.
        </p>
      </Section>

      <Section title="Founder access" icon="ti-users">
        {founders.length === 0 ? <p className="px-4 py-6 text-center text-sm text-slate-500">No founder has used the directory yet.</p> : founders.map((f) => (
          <div key={f.founderId} className="flex flex-wrap items-center gap-2 border-t border-slate-100 px-4 py-2.5 text-[13px] first:border-t-0">
            <span className="min-w-0 flex-1">
              <Link href={`/admin/investor-directory/usage/${f.founderId}`} className="text-slate-800 hover:text-[#1A6CE4]">{f.name}</Link>
              <span className="block text-[11.5px] text-slate-500">{f.company ?? "No company"} · {f.plan} · {n(f.held)} of {n(f.contactLimit)} contacts · {n(f.emailsUsed)} of {n(f.emailCap)} emails</span>
            </span>
            {f.status !== "active" ? <Tag tone={f.status === "paused" ? "warn" : "bad"}>{f.status === "paused" ? "Paused" : "Suspended"}</Tag> : null}
          </div>
        ))}
      </Section>

      <Section title="Gatekeeping rules" icon="ti-lock">
        {toggle("block_over_limit", "Block adding investors over the plan's limit", "Every source counts. Founders see an upgrade prompt instead")}
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
