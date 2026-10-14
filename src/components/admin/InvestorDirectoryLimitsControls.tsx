"use client";

/**
 * Investor directory limits by plan, on Admin, Feature controls. Same data as
 * Admin, Investor directory, Access: it saves through the same two routes, so
 * both places always agree. Searching the directory is never limited; these
 * numbers cap what a founder holds and the Manual outreach emails they send.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { postJson } from "@/components/admin/investor-directory/ui";
import type { DirectoryPlanAllowance, DirectorySettings } from "@/lib/investor-directory/types";

const n = (v: number) => v.toLocaleString("en-US");
const whole = (v: string) => Math.max(0, Math.round(Number(v.replace(/,/g, "")) || 0));

type RuleKey = "block_over_limit" | "tab_directory" | "tab_formd" | "tab_linkedin" | "tab_csv";
const TABS: { key: RuleKey; label: string }[] = [
  { key: "tab_directory", label: "Directory tab" },
  { key: "tab_formd", label: "Form D tab" },
  { key: "tab_linkedin", label: "LinkedIn tab" },
  { key: "tab_csv", label: "CSV or Excel tab" },
];

function Switch({ on, label, onChange }: Readonly<{ on: boolean; label: string; onChange: (v: boolean) => void }>) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)}
      className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${on ? "bg-[#1A6CE4]" : "bg-slate-300"}`}>
      <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${on ? "left-[18px]" : "left-0.5"}`} />
    </button>
  );
}

export function InvestorDirectoryLimitsControls({ allowances, settings }: Readonly<{
  allowances: DirectoryPlanAllowance[];
  settings: DirectorySettings;
}>) {
  const router = useRouter();
  const [rows, setRows] = useState(allowances);
  const [rules, setRules] = useState(settings);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  const setRow = (plan: string, patch: Partial<DirectoryPlanAllowance>) => {
    setMsg(null);
    setRows((rs) => rs.map((r) => (r.plan_type === plan ? { ...r, ...patch } : r)));
  };
  const setRule = (patch: Partial<DirectorySettings>) => {
    setMsg(null);
    setRules((s) => ({ ...s, ...patch }));
  };

  async function save() {
    setSaving(true);
    setMsg(null);
    try {
      for (const row of rows) {
        const before = allowances.find((a) => a.plan_type === row.plan_type);
        if (!before) continue;
        const patch: { contacts?: number; emails_per_month?: number } = {};
        if (row.contacts !== before.contacts) patch.contacts = row.contacts;
        if (row.emails_per_month !== before.emails_per_month) patch.emails_per_month = row.emails_per_month;
        if (Object.keys(patch).length === 0) continue;
        const r = await postJson("/api/admin/investor-directory/allowances", "PATCH", { plan_type: row.plan_type, ...patch });
        if (!r.ok) { setMsg({ text: r.error, ok: false }); return; }
      }
      const changed: Partial<DirectorySettings> = {};
      for (const k of ["block_over_limit", "daily_cap", "tab_directory", "tab_formd", "tab_linkedin", "tab_csv"] as const) {
        if (rules[k] !== settings[k]) (changed as Record<string, unknown>)[k] = rules[k];
      }
      if (Object.keys(changed).length > 0) {
        const r = await postJson("/api/admin/investor-directory/settings", "PATCH", changed);
        if (!r.ok) { setMsg({ text: r.error, ok: false }); return; }
      }
      setMsg({ text: "Saved. Applies to new imports immediately.", ok: true });
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="mt-8">
      <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-950">
        <i className="ti ti-users-group text-slate-500" aria-hidden="true" /> Investor directory limits by plan
      </h2>
      <p className="mt-1 max-w-2xl text-sm text-slate-600">
        How many investor contacts each plan can hold and how many Manual outreach emails it can send every 30 days. Searching is never limited.
      </p>

      <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-slate-100 text-left text-[11px] uppercase tracking-wide text-slate-400">
                <th className="px-4 py-2">Plan</th>
                <th className="px-2 py-2 text-right">Investor contacts</th>
                <th className="px-4 py-2 text-right">Emails per 30 days</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.plan_type} className="border-b border-slate-50">
                  <td className="px-4 py-2 font-medium text-slate-800">
                    {r.label}
                    {r.contacts <= 0 ? <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-normal text-slate-500">Browse only</span> : null}
                  </td>
                  <td className="px-2 py-2 text-right">
                    <input type="text" inputMode="numeric" value={n(r.contacts)} aria-label={`${r.label} investor contacts`}
                      onChange={(e) => setRow(r.plan_type, { contacts: whole(e.target.value) })}
                      className="h-8 w-28 rounded-md border border-slate-300 px-2 text-right" />
                  </td>
                  <td className="px-4 py-2 text-right">
                    <input type="text" inputMode="numeric" value={n(r.emails_per_month)} aria-label={`${r.label} emails per 30 days`}
                      onChange={(e) => setRow(r.plan_type, { emails_per_month: whole(e.target.value) })}
                      className="h-8 w-28 rounded-md border border-slate-300 px-2 text-right" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="border-t border-slate-100 px-4 py-2 text-[11px] uppercase tracking-wide text-slate-400">Tabs founders see</div>
        {TABS.map((t) => (
          <div key={t.key} className="flex items-center gap-2 border-t border-slate-100 px-4 py-2.5 text-[13px]">
            <span className="min-w-0 flex-1 text-slate-800">{t.label}</span>
            <Switch on={rules[t.key]} label={t.label} onChange={(v) => setRule({ [t.key]: v } as Partial<DirectorySettings>)} />
          </div>
        ))}

        <div className="border-t border-slate-100 px-4 py-2 text-[11px] uppercase tracking-wide text-slate-400">Enforcement</div>
        <div className="flex items-center gap-2 border-t border-slate-100 px-4 py-2.5 text-[13px]">
          <span className="min-w-0 flex-1">
            <span className="text-slate-800">Block imports over the limit</span>
            <span className="block text-[11.5px] text-slate-500">When off, founders can pass their plan and only see a warning.</span>
          </span>
          <Switch on={rules.block_over_limit} label="Block imports over the limit" onChange={(v) => setRule({ block_over_limit: v })} />
        </div>
        <label className="flex items-center gap-2 border-t border-slate-100 px-4 py-2.5 text-[13px]">
          <span className="min-w-0 flex-1">
            <span className="text-slate-800">Daily import cap</span>
            <span className="block text-[11.5px] text-slate-500">Most investors one founder can import per day (Pacific time).</span>
          </span>
          <input type="text" inputMode="numeric" value={n(rules.daily_cap)} aria-label="Daily import cap"
            onChange={(e) => setRule({ daily_cap: Math.max(1, whole(e.target.value)) })}
            className="h-8 w-24 rounded-md border border-slate-300 px-2 text-right" />
        </label>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-4 py-3">
          <span className="max-w-xl text-[12px] text-slate-500">
            Applies to new imports. Investors a founder already holds stay put. Form D firms and iCFO introductions don&apos;t count toward the limit. The same settings live on Investor directory, Access.
          </span>
          <span className="flex items-center gap-3">
            {msg ? <span className={`text-xs ${msg.ok ? "text-emerald-700" : "text-red-700"}`}>{msg.text}</span> : null}
            <button type="button" onClick={() => void save()} disabled={saving}
              className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-500 disabled:opacity-50">
              {saving ? "Saving…" : "Save limits"}
            </button>
          </span>
        </div>
      </div>
    </section>
  );
}
